import pkg from "@next/env"; pkg.loadEnvConfig(process.cwd());
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_SYNC_URL, { ssl:"require", max:1, prepare:false });
try {
  await sql`CREATE TABLE IF NOT EXISTS "wallet"."virtual_accounts" (
    "user_id" text PRIMARY KEY NOT NULL,
    "bank_name" text NOT NULL, "account_number" text NOT NULL UNIQUE,
    "account_name" text NOT NULL, "currency" text DEFAULT 'NGN' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL)`;
  await sql`DO $$ BEGIN
    ALTER TABLE "wallet"."virtual_accounts" ADD CONSTRAINT "va_user_fk" FOREIGN KEY ("user_id") REFERENCES "spurs"."users"("id") ON DELETE cascade;
  EXCEPTION WHEN duplicate_object THEN null; END $$`;
  console.log("wallet virtual_accounts ready");
} finally { await sql.end(); }
