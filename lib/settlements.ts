import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankAccounts, settlements, type BankAccount, type Settlement } from "@/lib/db/schema";
import { credit, debit, getBalance } from "@/lib/wallet";
import { resolveBankAccount, payoutToBank } from "@/lib/pay-client";
import { getWalletSettings } from "@/lib/settings";

/**
 * Bank withdrawals ("settlements"): move NGN out of the wallet to a bank account.
 * The wallet ledger is the system of record — we debit first, then ask Pay to
 * move the money on its rails. If the payout fails we refund the ledger, so a
 * failed bank transfer can never silently eat a balance.
 */

export async function listBankAccounts(userId: string): Promise<BankAccount[]> {
  return db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)).orderBy(desc(bankAccounts.createdAt));
}

/** Verify an account via name enquiry, then save it. */
export async function addBankAccount(userId: string, input: { bankName: string; bankCode: string; accountNumber: string }): Promise<BankAccount> {
  const accountNumber = input.accountNumber.trim();
  if (!/^\d{10}$/.test(accountNumber)) throw new Error("Account number must be 10 digits");

  const accountName = await resolveBankAccount(input.bankCode, accountNumber);
  if (!accountName) throw new Error("We couldn't verify that account — check the number and bank");

  const [row] = await db
    .insert(bankAccounts)
    .values({ userId, bankName: input.bankName, bankCode: input.bankCode, accountNumber, accountName })
    .onConflictDoUpdate({
      target: [bankAccounts.userId, bankAccounts.bankCode, bankAccounts.accountNumber],
      set: { accountName, bankName: input.bankName },
    })
    .returning();
  return row;
}

export async function removeBankAccount(userId: string, id: string) {
  await db.delete(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
}

export async function listSettlements(userId: string, limit = 50): Promise<Settlement[]> {
  return db.select().from(settlements).where(eq(settlements.userId, userId)).orderBy(desc(settlements.createdAt)).limit(limit);
}

/** Withdraw NGN to a saved bank account. Debits the ledger, then pays out via Pay. */
export async function withdrawToBank(userId: string, bankAccountId: string, amountMinor: bigint): Promise<Settlement> {
  if (amountMinor <= 0n) throw new Error("Enter a valid amount");

  const s = await getWalletSettings();
  if (!s.enabledAssets.includes("NGN")) throw new Error("NGN withdrawals are unavailable");

  const [bank] = await db.select().from(bankAccounts)
    .where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.userId, userId))).limit(1);
  if (!bank) throw new Error("Select a bank account to withdraw to");

  if (BigInt(await getBalance(userId, "NGN")) < amountMinor) throw new Error("Insufficient balance");

  const reference = "wsw_" + randomBytes(10).toString("hex");

  // 1) Reserve the funds on our ledger first.
  await debit(userId, "NGN", amountMinor, {
    source: "withdrawal",
    reference,
    description: `Withdrawal to ${bank.bankName} ••${bank.accountNumber.slice(-4)}`,
  });

  const [pending] = await db.insert(settlements).values({
    userId, reference, bankAccountId: bank.id, amount: amountMinor.toString(), currency: "NGN", status: "pending",
  }).returning();

  // 2) Ask Pay to move it on the bank rails.
  try {
    const result = await payoutToBank({
      bankCode: bank.bankCode,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      amount: Number(amountMinor),
      currency: "NGN",
      narration: "Spurs Wallet withdrawal",
      reference,
    });

    if (result.status === "failed") throw new Error("The bank rejected this transfer");

    const [done] = await db.update(settlements)
      .set({
        status: result.status === "successful" ? "successful" : "pending",
        providerRef: result.providerReference,
        completedAt: result.status === "successful" ? new Date() : null,
      })
      .where(eq(settlements.id, pending.id)).returning();
    return done;
  } catch (e) {
    // 3) Payout failed — put the money back so the ledger stays truthful.
    await credit(userId, "NGN", amountMinor, {
      source: "withdrawal",
      relatedRef: reference,
      description: "Reversed: withdrawal failed",
    });
    const [failed] = await db.update(settlements)
      .set({ status: "failed", failureReason: (e as Error).message, completedAt: new Date() })
      .where(eq(settlements.id, pending.id)).returning();
    return failed;
  }
}
