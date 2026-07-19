import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { debit } from "@/lib/wallet";
import { formatAsset } from "@/lib/assets";

// POST /api/private/wallet/debit  { user, asset, amount, description?, reference? }
// Trusted services (baas billing, cloud) charge a user's wallet balance.
const Schema = z.object({
  user: z.string().min(1),
  asset: z.string(),
  amount: z.number().int().positive(),
  description: z.string().max(200).optional(),
  reference: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  const { user, asset, amount, description, reference } = parsed.data;

  try {
    const t = await debit(user, asset, amount, { source: "payment", description, reference });
    return NextResponse.json({
      reference: t.reference,
      asset: t.asset,
      amount: t.amount,
      display: "-" + formatAsset(t.amount, t.asset),
      balanceAfter: t.balanceAfter,
    });
  } catch (e) {
    // Insufficient balance / unknown asset → 400
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
