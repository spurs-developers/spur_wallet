import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db, transactions, cryptoAddresses } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * "Did this user do X, and did they do it after time T?"
 *
 * Other Spurs services ask this to verify a real action rather than take
 * someone's word for it — Spurs Earn uses it to confirm that an
 * earn-by-doing task was genuinely completed, and that the deposit behind it
 * is a *new* one rather than a balance the user already had.
 */
const Body = z.object({
  user: z.string().min(1),
  kind: z.enum(["deposit", "convert", "crypto_wallet", "withdrawal"]),
  /** Only count activity strictly after this instant. */
  since: z.coerce.date().optional(),
  /** Minimum single amount, in minor units of `asset`. */
  minAmount: z.coerce.number().optional(),
  asset: z.string().optional(),
});

/** Ledger sources that count as each kind of activity. */
const SOURCES: Record<string, string[]> = {
  deposit: ["top_up", "crypto_deposit", "transfer_in", "gift_card"],
  convert: ["conversion"],
  withdrawal: ["withdrawal", "transfer_out"],
};

export async function POST(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || req.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { user, kind, since, minAmount, asset } = parsed.data;

  // Creating a crypto wallet isn't a ledger entry — it's a wallet row.
  if (kind === "crypto_wallet") {
    const rows = await db.select({ createdAt: cryptoAddresses.createdAt })
      .from(cryptoAddresses)
      .where(and(
        eq(cryptoAddresses.userId, user),
        ...(since ? [gt(cryptoAddresses.createdAt, since)] : []),
      ));
    return NextResponse.json({
      ok: true, count: rows.length, totalMinor: "0",
      latestAt: rows.length ? rows.map((r) => r.createdAt).sort().at(-1) : null,
    });
  }

  const sources = SOURCES[kind] ?? [];
  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
      largest: sql<string>`coalesce(max(${transactions.amount}), 0)::text`,
      latest: sql<Date | null>`max(${transactions.createdAt})`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, user),
      inArray(transactions.source, sources),
      // Conversions post both a debit and a credit; count one side only.
      eq(transactions.direction, kind === "withdrawal" ? "debit" : "credit"),
      ...(asset ? [eq(transactions.asset, asset)] : []),
      ...(since ? [gt(transactions.createdAt, since)] : []),
      ...(minAmount ? [sql`${transactions.amount} >= ${String(minAmount)}`] : []),
    ));

  const r = rows[0];
  return NextResponse.json({
    ok: true,
    count: Number(r.count),
    totalMinor: r.total,
    largestMinor: r.largest,
    latestAt: r.latest,
  });
}
