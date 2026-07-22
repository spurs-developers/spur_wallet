import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { creditCryptoDeposit } from "@/lib/crypto";
import { isAsset } from "@/lib/assets";

// POST /api/private/wallet/crypto-deposit  { userId, asset, network, amount, txHash }
// Called by the custody provider (or its webhook relay) when an on-chain deposit
// confirms. `amount` is exact integer minor units. Idempotent on `txHash`.
const Schema = z.object({
  userId: z.string().min(1),
  asset: z.string().min(1),
  network: z.string().min(1),
  amount: z.string().regex(/^\d+$/), // minor units as a string (crypto precision)
  txHash: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { userId, asset, network, amount, txHash } = parsed.data;
  if (!isAsset(asset)) return NextResponse.json({ error: "Unknown asset" }, { status: 400 });

  const t = await creditCryptoDeposit({ userId, asset, network, amount: BigInt(amount), txHash });
  return NextResponse.json({ credited: true, reference: t.reference });
}
