import { NextRequest, NextResponse } from "next/server";
import { authorizeInternalService } from "@/lib/api/internal-guard";
import { scanEvmDeposits, confirmEvmDeposits } from "@/lib/crypto-indexer";
import { sweepEvmDeposits } from "@/lib/crypto-sweep";

// POST /api/private/wallet/crypto-sync
// The self-hosted deposit engine's heartbeat — meant to run on a ~1 min cron.
// Scans your node for new deposits, advances confirmations (crediting the ledger
// once confirmed), and optionally sweeps confirmed deposits to the hot wallet.
// Trusted Spurs services only (internal secret).
export async function POST(req: NextRequest) {
  const auth = authorizeInternalService(req);
  if (!auth.ok) return auth.error;

  const scan = await scanEvmDeposits();
  const confirm = await confirmEvmDeposits();
  const sweep = await sweepEvmDeposits();

  return NextResponse.json({ scan, confirm, sweep });
}
