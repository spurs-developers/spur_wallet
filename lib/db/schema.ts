// Spurs Wallet control-plane schema (Postgres, on the shared Neon).
// A multi-asset store of value: one account per (user, asset), plus a ledger.
// Amounts are exact integer minor units stored as `numeric` (never floats) so
// crypto precision (BTC 8dp, USDT 6dp) is safe alongside fiat (NGN/USD 2dp).
import { pgSchema, text, uuid, numeric, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

// Ref to the shared user table (owned by baas). The Wallet upserts id/name/email
// on SSO login so its foreign keys resolve; other columns are managed elsewhere.
const spurs = pgSchema("spurs");
export const spursUsers = spurs.table("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email"),
});

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

/** A user's dedicated bank account for funding by transfer (one per user). */
export const virtualAccounts = wallet.table("virtual_accounts", {
  userId: text("user_id").primaryKey().references(() => spursUsers.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  accountName: text("account_name").notNull(),
  currency: text("currency").notNull().default("NGN"),
  provider: text("provider"),
  providerRef: text("provider_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A dedicated on-chain deposit address for a user, per (asset, network).
 * Like a virtual bank account, but for crypto — funds sent here credit the wallet. */
export const cryptoAddresses = wallet.table(
  "crypto_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(),     // USDT | BTC
    network: text("network").notNull(), // BTC | TRON | ETH
    address: text("address").notNull(),
    memo: text("memo"),                 // destination tag/memo where the network needs one
    provider: text("provider"),         // internal custody provider — never exposed
    providerRef: text("provider_ref"),  // provider handle, e.g. "ethereum:5" (HD index) — for sweeps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("crypto_addresses_user_asset_net_idx").on(t.userId, t.asset, t.network),
    uniqueIndex("crypto_addresses_address_idx").on(t.address),
  ],
);

/** An on-chain withdrawal to an external address. The ledger debit happens via
 * the normal wallet.transactions entry; this row tracks the chain-side lifecycle. */
export const cryptoWithdrawals = wallet.table(
  "crypto_withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(), // wcw_…
    asset: text("asset").notNull(),
    network: text("network").notNull(),
    toAddress: text("to_address").notNull(),
    amount: numeric("amount", { precision: 38, scale: 0 }).notNull(), // minor units
    fee: numeric("fee", { precision: 38, scale: 0 }).notNull().default("0"),
    status: text("status").notNull().default("pending"), // pending | sent | confirmed | failed
    txHash: text("tx_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("crypto_withdrawals_reference_idx").on(t.reference),
    index("crypto_withdrawals_user_idx").on(t.userId),
  ],
);

/** Chain-side tracking of an inbound deposit as our indexer sees it: detected →
 * confirmed → credited. The ledger credit is idempotent on tx hash, so this
 * table drives confirmations without ever double-crediting the wallet. */
export const cryptoDeposits = wallet.table(
  "crypto_deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(),
    network: text("network").notNull(),
    address: text("address").notNull(),
    txHash: text("tx_hash").notNull(),
    logIndex: integer("log_index").notNull().default(0), // disambiguates multiple transfers in one tx
    amount: numeric("amount", { precision: 38, scale: 0 }).notNull(), // minor units
    blockNumber: numeric("block_number", { precision: 20, scale: 0 }).notNull().default("0"),
    confirmations: integer("confirmations").notNull().default(0),
    status: text("status").notNull().default("pending"), // pending | confirmed | credited
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("crypto_deposits_tx_idx").on(t.txHash, t.address, t.logIndex),
    index("crypto_deposits_status_idx").on(t.status),
  ],
);

/** Per-network indexer checkpoint — the last block we've scanned for deposits. */
export const cryptoSyncState = wallet.table("crypto_sync_state", {
  network: text("network").primaryKey(),
  lastBlock: numeric("last_block", { precision: 20, scale: 0 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A user's saved bank account for withdrawals (name-enquiry verified via Pay). */
export const bankAccounts = wallet.table(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    bankName: text("bank_name").notNull(),
    bankCode: text("bank_code").notNull(),
    accountNumber: text("account_number").notNull(),
    accountName: text("account_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("bank_accounts_user_acct_idx").on(t.userId, t.bankCode, t.accountNumber)],
);

/** A withdrawal of wallet balance out to a bank account, executed through Pay. */
export const settlements = wallet.table(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => spursUsers.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),          // wsw_…
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 38, scale: 0 }).notNull(), // minor units
    fee: numeric("fee", { precision: 38, scale: 0 }).notNull().default("0"),
    currency: text("currency").notNull().default("NGN"),
    status: text("status").notNull().default("pending"), // pending | successful | failed
    providerRef: text("provider_ref"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("settlements_reference_idx").on(t.reference),
    index("settlements_user_idx").on(t.userId),
  ],
);

export type BankAccount = typeof bankAccounts.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type VirtualAccount = typeof virtualAccounts.$inferSelect;
export type CryptoAddress = typeof cryptoAddresses.$inferSelect;
export type CryptoWithdrawal = typeof cryptoWithdrawals.$inferSelect;
export type CryptoDeposit = typeof cryptoDeposits.$inferSelect;
