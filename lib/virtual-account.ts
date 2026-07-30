import { db, virtualAccounts, type VirtualAccount } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getUserBvn } from "./accounts-client";
import { creditOnce } from "@/lib/wallet";
import { maybeAwardFirstDeposit } from "@/lib/bonus";

// The Wallet doesn't own a bank relationship — Spurs Pay does. So we ask Pay to
// provision a dedicated NUBAN through whichever processor the admin has chosen
// (Flutterwave / PaymentPoint / Moniepoint), then store it against the user.
const PAY_URL = process.env.PAY_INTERNAL_URL ?? "http://localhost:3100";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

export async function getVirtualAccount(userId: string): Promise<VirtualAccount | null> {
  const [va] = await db.select().from(virtualAccounts).where(eq(virtualAccounts.userId, userId)).limit(1);
  return va ?? null;
}

/**
 * Give a user a dedicated funding account, provisioning one on first use.
 * Idempotent — a user only ever has one. Called when the user is created.
 */
export async function ensureVirtualAccount(userId: string, customerName: string): Promise<VirtualAccount> {
  const existing = await getVirtualAccount(userId);
  if (existing) return existing;

  const bvn = await getUserBvn(userId);
  const res = await fetch(`${PAY_URL}/api/private/virtual-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
    cache: "no-store",
    body: JSON.stringify({ reference: userId, customerName, mode: "live", ...(bvn ? { bvn } : {}) }),
  });
  if (!res.ok) throw new Error("Could not provision a funding account");
  const { data } = await res.json();

  const [va] = await db
    .insert(virtualAccounts)
    .values({
      userId,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      provider: data.provider ?? "sandbox",
      providerRef: data.providerRef ?? null,
    })
    .onConflictDoNothing({ target: virtualAccounts.userId })
    .returning();

  return va ?? (await getVirtualAccount(userId))!;
}

/**
 * Credit a wallet when a transfer lands on its dedicated account. In production
 * Spurs Pay calls this off the processor's webhook; in sandbox the deposit is
 * simulated. Idempotent on the bank reference, so a replayed webhook is safe.
 */
export async function creditVirtualAccountDeposit(
  accountNumber: string,
  amount: number,
  bankReference: string,
): Promise<{ credited: boolean; userId?: string }> {
  const [va] = await db.select().from(virtualAccounts).where(eq(virtualAccounts.accountNumber, accountNumber)).limit(1);
  if (!va) return { credited: false };

  await creditOnce(va.userId, va.currency, amount, {
    source: "top_up",
    relatedRef: bankReference,
    description: "Bank transfer",
  });
  await maybeAwardFirstDeposit(va.userId, va.currency, amount);
  return { credited: true, userId: va.userId };
}
