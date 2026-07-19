import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Guard for /api/private/* — trusted Spurs services only (accounts, baas, cloud).
 * Auth: header  x-internal-secret: <INTERNAL_API_SECRET>
 */
export function authorizeInternalService(
  req: NextRequest,
): { ok: true } | { ok: false; error: NextResponse } {
  const secret = process.env.INTERNAL_API_SECRET ?? "";
  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!secret || !provided || !safeEqual(provided, secret)) {
    return { ok: false, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}
