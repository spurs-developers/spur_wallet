import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { startTopup } from "@/lib/topup";

// POST /api/private/wallet/topup  { user, amount, asset?, callbackUrl? }
// Starts a fiat top-up: creates a Spurs Pay payment and returns its checkout URL.
// The wallet is credited later, on verify (after the customer pays).
const Schema = z.object({
  user: z.string().min(1),
  amount: z.number().int().positive(), // minor units of the asset
  asset: z.string().optional(),
  callbackUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });

  try {
    const { user, amount, asset, callbackUrl } = parsed.data;
    return NextResponse.json(await startTopup(user, amount, asset, callbackUrl));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
