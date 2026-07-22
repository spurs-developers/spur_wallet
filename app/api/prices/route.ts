import { NextResponse } from "next/server";
import { getQuotes, usdNgnRate } from "@/lib/prices";

// GET /api/prices — live market quotes for the dashboard to poll. Cheap: the
// underlying Binance fetch is cached (~60s), so frequent polling is fine.
export async function GET() {
  const quotes = await getQuotes();
  return NextResponse.json({ quotes, usdNgn: usdNgnRate() });
}
