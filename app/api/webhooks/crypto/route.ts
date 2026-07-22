import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cryptoAddresses } from "@/lib/db/schema";
import { creditCryptoDeposit } from "@/lib/crypto";
import { toMinorUnits, isAsset } from "@/lib/assets";
import { getAdminConfig } from "@/lib/admin-config";

// POST /api/webhooks/crypto?token=<secret>
// Public endpoint the custody provider (Tatum ADDRESS_TRANSACTION) calls when an
// on-chain deposit lands. We map the address → our user/asset and credit the
// ledger, idempotent on the tx hash. Auth is the URL token (kept in admin config).
export async function POST(req: NextRequest) {
  const provided = req.nextUrl.searchParams.get("token") ?? "";
  const cfg = await getAdminConfig();
  const expected = cfg.SPURS_CRYPTO_WEBHOOK_TOKEN ?? process.env.SPURS_CRYPTO_WEBHOOK_TOKEN ?? process.env.INTERNAL_API_SECRET ?? "";
  if (!expected || provided !== expected) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const address = body?.address;
  const amount = body?.amount;
  const txId = body?.txId ?? body?.txHash;
  if (!address || amount == null || !txId) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const [addr] = await db.select().from(cryptoAddresses).where(eq(cryptoAddresses.address, String(address))).limit(1);
  if (!addr) return NextResponse.json({ ignored: true }); // deposit to an address we don't own

  if (!isAsset(addr.asset)) return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  const minor = toMinorUnits(String(amount), addr.asset);
  if (minor <= 0n) return NextResponse.json({ error: "Non-positive amount" }, { status: 400 });

  const t = await creditCryptoDeposit({ userId: addr.userId, asset: addr.asset, network: addr.network, amount: minor, txHash: String(txId) });
  return NextResponse.json({ credited: true, reference: t.reference });
}
