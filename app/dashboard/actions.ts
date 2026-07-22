"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { startTopup } from "@/lib/topup";
import { transfer, convert, debit, getBalance, sentTodayMinor } from "@/lib/wallet";
import { db, spursUsers } from "@/lib/db";
import { getAsset, isAsset, DEFAULT_ASSET, toMinorUnits, formatAsset } from "@/lib/assets";
import { getWalletSettings, assertAssetEnabled } from "@/lib/settings";
import { convertAtMarket } from "@/lib/convert";
import { addBankAccount, removeBankAccount, withdrawToBank } from "@/lib/settlements";
import { getOrCreateAddress, withdrawCrypto, creditCryptoDeposit, networkInfo } from "@/lib/crypto";
import { randomBytes } from "node:crypto";

/** Convert a major-unit amount (e.g. "50.00") to integer minor units for an asset. */
function toMinor(input: string, assetCode: string): number {
  const asset = getAsset(assetCode);
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid amount");
  return Math.round(n * 10 ** asset.decimals);
}

export async function startTopupAction(formData: FormData) {
  const user = await requireUser();
  const assetCode = String(formData.get("asset") ?? DEFAULT_ASSET);
  const amountRaw = String(formData.get("amount") ?? "");

  if (!isAsset(assetCode)) redirect("/dashboard?error=Unknown+asset");

  let checkoutUrl: string;
  try {
    const s = await getWalletSettings();
    if (!s.topupEnabled) throw new Error("Top-ups are currently disabled");
    assertAssetEnabled(s, assetCode);

    const minor = toMinor(amountRaw, assetCode);
    if (assetCode === "NGN" && BigInt(minor) < s.minTopupMinor) {
      throw new Error(`Minimum top-up is ${formatAsset(s.minTopupMinor.toString(), "NGN")}`);
    }
    const returnUrl = `${process.env.APP_URL}/dashboard/topup/return`;
    ({ checkoutUrl } = await startTopup(user.sub, minor, assetCode, returnUrl));
  } catch (e) {
    redirect(`/dashboard?error=${encodeURIComponent((e as Error).message)}`);
  }

  redirect(checkoutUrl); // hosted Spurs Pay checkout
}

export async function sendMoneyAction(formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const assetCode = String(formData.get("asset") ?? DEFAULT_ASSET);
  const amountRaw = String(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 140) || undefined;
  const back = "/dashboard/send";

  if (!isAsset(assetCode)) redirect(`${back}?error=Unknown+currency`);
  try {
    const s = await getWalletSettings();
    if (!s.sendEnabled) throw new Error("Sending is currently disabled");
    assertAssetEnabled(s, assetCode);

    const minor = toMinor(amountRaw, assetCode);
    const amount = BigInt(minor);
    const fee = assetCode === "NGN" ? s.sendFeeFlatMinor : 0n;

    // Daily send limit (NGN only — the limit is denominated in naira).
    if (assetCode === "NGN" && s.dailySendLimitMinor > 0n) {
      const sent = await sentTodayMinor(user.sub, "NGN");
      if (sent + amount > s.dailySendLimitMinor) {
        throw new Error(`Daily send limit of ${formatAsset(s.dailySendLimitMinor.toString(), "NGN")} reached`);
      }
    }
    // Make sure the sender can cover amount + fee before moving anything.
    if (fee > 0n && BigInt(await getBalance(user.sub, assetCode)) < amount + fee) {
      throw new Error(`Insufficient balance (a ${formatAsset(fee.toString(), "NGN")} send fee applies)`);
    }

    const [recipient] = await db.select().from(spursUsers).where(eq(spursUsers.email, email)).limit(1);
    if (!recipient) redirect(`${back}?error=${encodeURIComponent("No Spurs user with that email")}`);
    await transfer(user.sub, recipient!.id, assetCode, minor, note);
    if (fee > 0n) {
      await debit(user.sub, assetCode, fee, { source: "payment", description: "Send fee" });
    }
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/dashboard");
  redirect(`${back}?ok=1`);
}

export async function convertAction(formData: FormData) {
  const user = await requireUser();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const back = "/dashboard/convert";

  if (!isAsset(from) || !isAsset(to) || from === to) redirect(`${back}?error=Pick+two+different+currencies`);
  try {
    const s = await getWalletSettings();
    if (!s.convertEnabled) throw new Error("Conversions are currently disabled");
    assertAssetEnabled(s, from);
    assertAssetEnabled(s, to);

    // Live market rate, minus the platform conversion fee.
    const q = await convertAtMarket(from, to, BigInt(toMinor(amountRaw, from)), s.convertFeePercent);
    await convert(user.sub, { asset: from, amount: q.fromMinor.toString() }, { asset: to, amount: q.toMinor.toString() });
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/dashboard");
  redirect(`${back}?ok=1`);
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/* --------------------------- bank withdrawals ---------------------------- */

export async function addBankAccountAction(formData: FormData) {
  const user = await requireUser();
  const back = "/dashboard/settlements";
  const [bankCode, bankName] = String(formData.get("bank") ?? "").split("|");
  try {
    if (!bankCode) throw new Error("Pick a bank");
    await addBankAccount(user.sub, { bankCode, bankName: bankName ?? bankCode, accountNumber: String(formData.get("accountNumber") ?? "") });
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent(errMsg(e))}`);
  }
  revalidatePath(back);
  redirect(`${back}?ok=Bank+account+added`);
}

export async function removeBankAccountAction(id: string) {
  const user = await requireUser();
  await removeBankAccount(user.sub, id);
  revalidatePath("/dashboard/settlements");
}

export async function withdrawAction(formData: FormData) {
  const user = await requireUser();
  const back = "/dashboard/settlements";
  let msg = "Withdrawal sent";
  try {
    const minor = BigInt(toMinor(String(formData.get("amount") ?? ""), "NGN"));
    const result = await withdrawToBank(user.sub, String(formData.get("bankAccountId") ?? ""), minor);
    if (result.status === "failed") throw new Error(result.failureReason ?? "Withdrawal failed");
    if (result.status === "pending") msg = "Withdrawal is processing";
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent(errMsg(e))}`);
  }
  revalidatePath("/dashboard");
  revalidatePath(back);
  redirect(`${back}?ok=${encodeURIComponent(msg)}`);
}

/** Issue (or fetch) the user's deposit address for an asset + network. */
export async function createAddressAction(asset: string, network: string) {
  const user = await requireUser();
  try {
    const a = await getOrCreateAddress(user.sub, asset, network);
    revalidatePath("/dashboard/crypto");
    return { ok: true as const, address: a.address, memo: a.memo ?? null, contract: networkInfo(asset, network)?.contract ?? null };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

/** Send crypto on-chain to an external address (contract-aware for tokens). */
export async function withdrawCryptoAction(input: { asset: string; network: string; toAddress: string; amount: string }) {
  const user = await requireUser();
  try {
    const minor = toMinorUnits(input.amount, input.asset);
    if (minor <= 0n) throw new Error("Enter a valid amount");
    const w = await withdrawCrypto(user.sub, { asset: input.asset, network: input.network, toAddress: input.toAddress.trim(), amount: minor });
    revalidatePath("/dashboard/crypto");
    revalidatePath("/dashboard/transactions");
    return { ok: true as const, reference: w.reference, txHash: w.txHash };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}

/** Sandbox helper: simulate an inbound on-chain deposit so users can test receiving. */
export async function simulateDepositAction(input: { asset: string; network: string; amount: string }) {
  const user = await requireUser();
  try {
    const minor = toMinorUnits(input.amount, input.asset);
    if (minor <= 0n) throw new Error("Enter a valid amount");
    const txHash = (input.network === "ETH" ? "0x" : "") + randomBytes(32).toString("hex");
    await creditCryptoDeposit({ userId: user.sub, asset: input.asset, network: input.network, amount: minor, txHash });
    revalidatePath("/dashboard/crypto");
    revalidatePath("/dashboard/transactions");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }
}
