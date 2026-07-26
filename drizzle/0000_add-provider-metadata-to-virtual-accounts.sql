ALTER TABLE "wallet"."virtual_accounts" ADD COLUMN IF NOT EXISTS "provider" text;
--> statement-breakpoint
ALTER TABLE "wallet"."virtual_accounts" ADD COLUMN IF NOT EXISTS "provider_ref" text;