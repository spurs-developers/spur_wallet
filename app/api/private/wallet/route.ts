import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { getBalances } from "@/lib/wallet";
import { ASSETS, DEFAULT_ASSET, formatAsset } from "@/lib/assets";

// GET /api/private/wallet?user=<spursUserId>  → all balances for a user.
// Always returns the default (NGN) balance even if the account row doesn't exist yet.
export async function GET(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const user = req.nextUrl.searchParams.get("user");
  if (!user) return NextResponse.json({ error: "Missing user" }, { status: 400 });

  const rows = await getBalances(user);
  const byAsset = new Map(rows.map((r) => [r.asset, r.balance]));
  if (!byAsset.has(DEFAULT_ASSET)) byAsset.set(DEFAULT_ASSET, "0");

  const balances = [...byAsset.entries()].map(([asset, balance]) => ({
    asset,
    kind: ASSETS[asset]?.kind ?? "fiat",
    balance,                                   // integer minor units (string)
    display: formatAsset(balance, asset),      // human-readable
  }));

  return NextResponse.json({ user, balances });
}
