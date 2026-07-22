import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { creditVirtualAccountDeposit } from "@/lib/virtual-account";

// POST /api/private/wallet/va-deposit  { accountNumber, amount, reference }
// Called by Spurs Pay when a transfer lands on a user's dedicated account.
// Idempotent on `reference`, so a replayed webhook credits at most once.
const Schema = z.object({
  accountNumber: z.string(),
  amount: z.number().int().positive(),
  reference: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { accountNumber, amount, reference } = parsed.data;
  const result = await creditVirtualAccountDeposit(accountNumber, amount, reference);
  if (!result.credited) return NextResponse.json({ error: "Unknown account" }, { status: 404 });
  return NextResponse.json({ credited: true });
}
