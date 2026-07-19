import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { listTransactions } from "@/lib/wallet";
import { formatAsset } from "@/lib/assets";

// GET /api/private/wallet/transactions?user=<id>&asset=<code>&limit=<n>
export async function GET(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const user = req.nextUrl.searchParams.get("user");
  if (!user) return NextResponse.json({ error: "Missing user" }, { status: 400 });
  const asset = req.nextUrl.searchParams.get("asset") ?? undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;

  const rows = await listTransactions(user, { asset, limit });
  const items = rows.map((t) => ({
    reference: t.reference,
    asset: t.asset,
    direction: t.direction,
    amount: t.amount,
    display: (t.direction === "debit" ? "-" : "+") + formatAsset(t.amount, t.asset),
    balanceAfter: t.balanceAfter,
    source: t.source,
    description: t.description,
    createdAt: t.createdAt,
  }));
  return NextResponse.json({ items });
}
