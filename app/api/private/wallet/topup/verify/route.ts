import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { finalizeTopup } from "@/lib/topup";

// POST /api/private/wallet/topup/verify  { reference }  → confirm + credit (idempotent)
export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const body = await req.json().catch(() => ({}));
  const reference = String(body.reference ?? "");
  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });

  try {
    return NextResponse.json(await finalizeTopup(reference));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
