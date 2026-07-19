"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { startTopup } from "@/lib/topup";
import { transfer, convert } from "@/lib/wallet";
import { convertMinor } from "@/lib/fx";
import { db, spursUsers } from "@/lib/db";
import { getAsset, isAsset, DEFAULT_ASSET } from "@/lib/assets";

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
    const minor = toMinor(amountRaw, assetCode);
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
    const minor = toMinor(amountRaw, assetCode);
    const [recipient] = await db.select().from(spursUsers).where(eq(spursUsers.email, email)).limit(1);
    if (!recipient) redirect(`${back}?error=${encodeURIComponent("No Spurs user with that email")}`);
    await transfer(user.sub, recipient!.id, assetCode, minor, note);
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
    const fromMinor = toMinor(amountRaw, from);
    const toAmount = convertMinor(from, to, fromMinor);
    if (toAmount <= 0) redirect(`${back}?error=Amount+too+small+to+convert`);
    await convert(user.sub, { asset: from, amount: fromMinor }, { asset: to, amount: toAmount });
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/dashboard");
  redirect(`${back}?ok=1`);
}
