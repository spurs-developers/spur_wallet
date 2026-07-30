import { randomBytes } from "node:crypto";
import { createPayPayment, getPayPayment } from "@/lib/pay-client";
import { creditOnce } from "@/lib/wallet";
import { maybeAwardFirstDeposit } from "@/lib/bonus";
import { getAsset, DEFAULT_ASSET } from "@/lib/assets";

// Shared top-up logic, used by both the private API (accounts/baas) and the
// Wallet's own UI. Top-ups settle in fiat through Spurs Pay; crypto is on-chain.

export async function startTopup(user: string, amount: number, assetCode = DEFAULT_ASSET, callbackUrl?: string) {
  const asset = getAsset(assetCode);
  if (asset.kind !== "fiat") throw new Error("Only fiat balances can be topped up via card/transfer.");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Amount must be a positive integer (minor units).");

  const reference = "wtp_" + randomBytes(12).toString("hex");
  // The customer returns to callbackUrl after paying; carry the ref so we can verify.
  const returnUrl = callbackUrl
    ? callbackUrl + (callbackUrl.includes("?") ? "&" : "?") + "ref=" + reference
    : undefined;
  const payment = await createPayPayment({
    merchant: user,
    amount,
    currency: asset.code,
    description: "Spurs Wallet top-up",
    reference,
    callbackUrl: returnUrl,
    metadata: { walletTopup: true, walletUser: user, asset: asset.code },
  });
  return { checkoutUrl: payment.checkoutUrl, reference: payment.reference };
}

export type FinalizeResult =
  | { status: "successful"; credited: boolean; asset: string; amount: number }
  | { status: "failed" | "pending" };

/** Confirm a top-up with Spurs Pay and credit the wallet exactly once. */
export async function finalizeTopup(reference: string): Promise<FinalizeResult> {
  const payment = await getPayPayment(reference);
  if (!payment) return { status: "failed" };
  if (payment.status !== "successful") return { status: payment.status };

  const user = String(payment.metadata?.walletUser ?? "");
  const asset = String(payment.metadata?.asset ?? DEFAULT_ASSET);
  if (!user) return { status: "failed" };

  // creditOnce is idempotent on (source=top_up, relatedRef=reference).
  await creditOnce(user, asset, payment.amount, {
    source: "top_up",
    relatedRef: reference,
    description: "Wallet top-up",
  });
  await maybeAwardFirstDeposit(user, asset, payment.amount);
  return { status: "successful", credited: true, asset, amount: payment.amount };
}
