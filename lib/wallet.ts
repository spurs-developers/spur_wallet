import { db } from "@/lib/db";
import { accounts, transactions, type Transaction } from "@/lib/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { isAsset } from "@/lib/assets";

export type Source =
  | "top_up" | "gift_card" | "crypto_deposit"
  | "payment" | "withdrawal"
  | "transfer_in" | "transfer_out" | "conversion";

interface EntryOpts {
  source: Source;
  reference?: string;
  relatedRef?: string;
  description?: string;
}

function newRef() {
  return "wtx_" + randomBytes(10).toString("hex");
}

/** All balances a user holds, one per asset. */
export async function getBalances(userId: string) {
  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId));
  return rows.map((r) => ({ asset: r.asset, balance: r.balance }));
}

export async function getBalance(userId: string, asset: string): Promise<string> {
  const [row] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.asset, asset)))
    .limit(1);
  return row?.balance ?? "0";
}

/** Total sent out today in an asset (minor units) — drives daily send limits. */
export async function sentTodayMinor(userId: string, asset: string): Promise<bigint> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.asset, asset),
      eq(transactions.source, "transfer_out"),
      gte(transactions.createdAt, start),
    ));
  return rows.reduce((sum, r) => sum + BigInt(r.amount), 0n);
}

export async function listTransactions(userId: string, opts: { asset?: string; limit?: number } = {}) {
  const conds = [eq(transactions.userId, userId)];
  if (opts.asset) conds.push(eq(transactions.asset, opts.asset));
  return db
    .select()
    .from(transactions)
    .where(and(...conds))
    .orderBy(desc(transactions.createdAt))
    .limit(opts.limit ?? 50);
}

// Get-or-create the account row and lock it for the rest of the transaction.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function lockAccount(tx: Tx, userId: string, asset: string) {
  await tx.insert(accounts).values({ userId, asset }).onConflictDoNothing({ target: [accounts.userId, accounts.asset] });
  const [acc] = await tx
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.asset, asset)))
    .for("update")
    .limit(1);
  return acc;
}

async function post(tx: Tx, userId: string, asset: string, amount: bigint, direction: "credit" | "debit", opts: EntryOpts): Promise<Transaction> {
  const acc = await lockAccount(tx, userId, asset);
  const current = BigInt(acc.balance);
  const next = direction === "credit" ? current + amount : current - amount;
  if (next < 0n) throw new Error("Insufficient balance");

  await tx.update(accounts).set({ balance: next.toString(), updatedAt: new Date() }).where(eq(accounts.id, acc.id));
  const [t] = await tx
    .insert(transactions)
    .values({
      userId,
      accountId: acc.id,
      asset,
      direction,
      amount: amount.toString(),
      balanceAfter: next.toString(),
      source: opts.source,
      reference: opts.reference ?? newRef(),
      relatedRef: opts.relatedRef ?? null,
      description: opts.description ?? null,
    })
    .returning();
  return t;
}

function assertAmount(asset: string, amount: string | number | bigint): bigint {
  if (!isAsset(asset)) throw new Error(`Unknown asset: ${asset}`);
  const amt = BigInt(amount);
  if (amt <= 0n) throw new Error("Amount must be positive");
  return amt;
}

/** Add funds to a user's balance in an asset. */
export async function credit(userId: string, asset: string, amount: string | number | bigint, opts: EntryOpts) {
  const amt = assertAmount(asset, amount);
  return db.transaction((tx) => post(tx, userId, asset, amt, "credit", opts));
}

/** Remove funds from a user's balance (throws if insufficient). */
export async function debit(userId: string, asset: string, amount: string | number | bigint, opts: EntryOpts) {
  const amt = assertAmount(asset, amount);
  return db.transaction((tx) => post(tx, userId, asset, amt, "debit", opts));
}

/** Credit exactly once for a given external ref+source (idempotent top-ups). */
export async function creditOnce(
  userId: string,
  asset: string,
  amount: string | number | bigint,
  opts: EntryOpts & { relatedRef: string },
): Promise<Transaction> {
  const amt = assertAmount(asset, amount);
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.relatedRef, opts.relatedRef), eq(transactions.source, opts.source)))
      .limit(1);
    if (existing) return existing;
    return post(tx, userId, asset, amt, "credit", opts);
  });
}

/** Move funds between two users in the same asset, atomically. */
export async function transfer(
  fromUser: string,
  toUser: string,
  asset: string,
  amount: string | number | bigint,
  description?: string,
) {
  const amt = assertAmount(asset, amount);
  if (fromUser === toUser) throw new Error("You can't send money to yourself");
  const group = "trf_" + randomBytes(8).toString("hex");
  return db.transaction(async (tx) => {
    const out = await post(tx, fromUser, asset, amt, "debit", { source: "transfer_out", relatedRef: group, description: description ?? "Sent" });
    const inn = await post(tx, toUser, asset, amt, "credit", { source: "transfer_in", relatedRef: group, description: description ?? "Received" });
    return { group, debit: out, credit: inn };
  });
}

/** Convert one asset to another as a linked debit + credit at a given rate. */
export async function convert(
  userId: string,
  from: { asset: string; amount: string | number | bigint },
  to: { asset: string; amount: string | number | bigint },
) {
  const debitAmt = assertAmount(from.asset, from.amount);
  const creditAmt = assertAmount(to.asset, to.amount);
  const group = "cvt_" + randomBytes(8).toString("hex");
  return db.transaction(async (tx) => {
    const out = await post(tx, userId, from.asset, debitAmt, "debit", { source: "conversion", relatedRef: group, description: `Convert to ${to.asset}` });
    const inn = await post(tx, userId, to.asset, creditAmt, "credit", { source: "conversion", relatedRef: group, description: `Convert from ${from.asset}` });
    return { group, debit: out, credit: inn };
  });
}
