// Spurs Wallet control-plane schema (Postgres, on the shared Neon).
// A multi-asset store of value: one account per (user, asset), plus a ledger.
// Amounts are exact integer minor units stored as `numeric` (never floats) so
// crypto precision (BTC 8dp, USDT 6dp) is safe alongside fiat (NGN/USD 2dp).
import { pgSchema, text, uuid, numeric, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// Minimal ref to the shared user table (owned by baas) for the FK only.
const spurs = pgSchema("spurs");
export const spursUsers = spurs.table("users", { id: text("id").primaryKey() });

export const wallet = pgSchema("wallet");

/** A balance for one user in one asset. One row per (user, asset). */
export const accounts = wallet.table(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(), // NGN | USD | USDT | BTC ... (see lib/assets.ts)
    balance: numeric("balance", { precision: 38, scale: 0 }).notNull().default("0"), // minor units
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("accounts_user_asset_idx").on(t.userId, t.asset)],
);

/** Immutable ledger. Every balance change is one entry (credit or debit). */
export const transactions = wallet.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(),
    direction: text("direction").notNull(),            // credit | debit
    amount: numeric("amount", { precision: 38, scale: 0 }).notNull(),      // positive minor units
    balanceAfter: numeric("balance_after", { precision: 38, scale: 0 }).notNull(),
    source: text("source").notNull(),                  // top_up | gift_card | crypto_deposit | payment | withdrawal | transfer_in | transfer_out | conversion
    reference: text("reference").notNull(),            // Spurs Wallet reference (wtx_...)
    relatedRef: text("related_ref"),                   // external ref (Pay reference, conversion group, counterparty)
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("transactions_reference_idx").on(t.reference),
    index("transactions_user_idx").on(t.userId),
    index("transactions_related_idx").on(t.relatedRef),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
