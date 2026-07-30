import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { creditOnce } from "@/lib/wallet";
import { formatAsset } from "@/lib/assets";
import { isAsset } from "@/lib/assets";

// POST /api/private/wallet/credit  { user, asset, amount, source?, reference, description? }
// Trusted first-party services (e.g. Spurs Survey paying out task earnings)
// credit a user's wallet. Idempotent on `reference`, so a retried call pays once.
const Schema = z.object({
  user: z.string().min(1),
  asset: z.string(),
  amount: z.number().int().positive(),
  source: z.enum(["task_reward", "gift_card", "top_up", "transfer_in", "crypto_deposit", "referral_bonus", "signup_bonus"]).optional(),
  reference: z.string().min(3),
  description: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const { user, asset, amount, source, reference, description } = parsed.data;
  if (!isAsset(asset)) return NextResponse.json({ error: "Unknown asset" }, { status: 400 });

  try {
    const t = await creditOnce(user, asset, amount, {
      source: source ?? "task_reward",
      relatedRef: reference,
      description: description ?? "Credit",
    });
    return NextResponse.json({
      reference: t.reference,
      asset: t.asset,
      amount: t.amount,
      display: "+" + formatAsset(t.amount, t.asset),
      balanceAfter: t.balanceAfter,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
