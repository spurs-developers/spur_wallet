import pkg from "@next/env";
pkg.loadEnvConfig(process.cwd());
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_SYNC_URL, { ssl: "require", max: 1, prepare: false });
try {
  await sql`CREATE SCHEMA IF NOT EXISTS "wallet"`;

  await sql`CREATE TABLE IF NOT EXISTS "wallet"."accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "asset" text NOT NULL,
    "balance" numeric(38,0) DEFAULT '0' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL)`;

  await sql`CREATE TABLE IF NOT EXISTS "wallet"."transactions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" text NOT NULL,
    "account_id" uuid NOT NULL,
    "asset" text NOT NULL,
    "direction" text NOT NULL,
    "amount" numeric(38,0) NOT NULL,
    "balance_after" numeric(38,0) NOT NULL,
    "source" text NOT NULL,
    "reference" text NOT NULL,
    "related_ref" text,
    "description" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL)`;

  const fk = async (t, name, col) => sql`DO $$ BEGIN
    ALTER TABLE ${sql(`wallet.${t}`)} ADD CONSTRAINT ${sql(name)} FOREIGN KEY (${sql(col)}) REFERENCES "spurs"."users"("id") ON DELETE cascade;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  await fk("accounts", "accounts_user_id_users_id_fk", "user_id");
  await fk("transactions", "transactions_user_id_users_id_fk", "user_id");
  await sql`DO $$ BEGIN
    ALTER TABLE "wallet"."transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "wallet"."accounts"("id") ON DELETE cascade;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "accounts_user_asset_idx" ON "wallet"."accounts" ("user_id","asset")`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "transactions_reference_idx" ON "wallet"."transactions" ("reference")`;
  await sql`CREATE INDEX IF NOT EXISTS "transactions_user_idx" ON "wallet"."transactions" ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "transactions_related_idx" ON "wallet"."transactions" ("related_ref")`;

  console.log("wallet schema ready");
} finally { await sql.end(); }
