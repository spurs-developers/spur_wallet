import { JsonRpcProvider, Contract, getAddress } from "ethers";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { cryptoAddresses, cryptoDeposits, cryptoSyncState } from "@/lib/db/schema";
import { creditCryptoDeposit } from "@/lib/crypto";
import { getAdminConfig } from "@/lib/admin-config";

/**
 * Self-hosted EVM deposit indexer. Scans YOUR Ethereum node (no third-party
 * custody/API) for inbound transfers to our derived deposit addresses — ERC-20
 * USDT via Transfer logs, native ETH via block transactions — records them,
 * tracks confirmations, and credits the ledger once confirmed. Idempotent
 * throughout: safe to run on a cron, re-run, and survive restarts.
 */

const USDT_MAINNET = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const MAX_RANGE = 200;           // blocks scanned per run (bounds work per tick)
const TRANSFER_ABI = ["event Transfer(address indexed from, address indexed to, uint256 value)"];

async function config(): Promise<Record<string, string | undefined>> {
  return { ...process.env, ...(await getAdminConfig()) };
}

function ethProvider(cfg: Record<string, string | undefined>): JsonRpcProvider | null {
  const url = cfg.SELF_RPC_ETHEREUM?.trim();
  return url ? new JsonRpcProvider(url) : null;
}

async function checkpoint(network: string): Promise<number> {
  const [row] = await db.select().from(cryptoSyncState).where(eq(cryptoSyncState.network, network)).limit(1);
  return row ? Number(row.lastBlock) : 0;
}
async function setCheckpoint(network: string, block: number) {
  await db.insert(cryptoSyncState).values({ network, lastBlock: String(block), updatedAt: new Date() })
    .onConflictDoUpdate({ target: cryptoSyncState.network, set: { lastBlock: String(block), updatedAt: new Date() } });
}

/** Our EVM deposit addresses → {userId, asset}, keyed by lowercase address. */
async function evmAddressMap(): Promise<Map<string, { userId: string; asset: string }>> {
  const rows = await db.select().from(cryptoAddresses).where(eq(cryptoAddresses.network, "ETH"));
  return new Map(rows.map((r) => [r.address.toLowerCase(), { userId: r.userId, asset: r.asset }]));
}

async function recordDeposit(d: {
  userId: string; asset: string; address: string; txHash: string; logIndex: number; amount: bigint; block: number;
}) {
  await db.insert(cryptoDeposits).values({
    userId: d.userId, asset: d.asset, network: "ETH", address: d.address,
    txHash: d.txHash, logIndex: d.logIndex, amount: d.amount.toString(),
    blockNumber: String(d.block), status: "pending",
  }).onConflictDoNothing();
}

/** Scan new blocks for deposits into our addresses. Returns a small summary. */
export async function scanEvmDeposits(): Promise<{ ok: boolean; from?: number; to?: number; found?: number; reason?: string }> {
  const cfg = await config();
  const provider = ethProvider(cfg);
  if (!provider) return { ok: false, reason: "no ETH RPC configured" };

  const map = await evmAddressMap();
  const current = await provider.getBlockNumber();
  const last = await checkpoint("ETH");
  const from = last > 0 ? last + 1 : current;            // first run starts "now"
  const to = Math.min(current, from + MAX_RANGE - 1);
  if (from > to) { await setCheckpoint("ETH", current); return { ok: true, from, to: current, found: 0 }; }

  let found = 0;

  // ERC-20 USDT deposits (efficient — indexed Transfer logs to our addresses).
  const usdtAddrs = [...map.entries()].filter(([, v]) => v.asset === "USDT").map(([a]) => getAddress(a));
  if (usdtAddrs.length) {
    const usdt = new Contract(cfg.SELF_USDT_CONTRACT_ETHEREUM?.trim() || USDT_MAINNET, TRANSFER_ABI, provider);
    const logs = await usdt.queryFilter(usdt.filters.Transfer(null, usdtAddrs), from, to);
    for (const log of logs) {
      const ev = log as unknown as { args: { to: string; value: bigint }; transactionHash: string; index: number; blockNumber: number };
      const owner = map.get(ev.args.to.toLowerCase());
      if (!owner || owner.asset !== "USDT") continue;
      await recordDeposit({ userId: owner.userId, asset: "USDT", address: getAddress(ev.args.to), txHash: ev.transactionHash, logIndex: ev.index, amount: ev.args.value, block: ev.blockNumber });
      found++;
    }
  }

  // Native ETH deposits (scan block transactions).
  const wantsNative = [...map.values()].some((v) => v.asset === "ETH");
  if (wantsNative) {
    for (let n = from; n <= to; n++) {
      const block = await provider.getBlock(n, true);
      if (!block) continue;
      for (const tx of block.prefetchedTransactions) {
        if (!tx.to || tx.value <= 0n) continue;
        const owner = map.get(tx.to.toLowerCase());
        if (!owner || owner.asset !== "ETH") continue;
        await recordDeposit({ userId: owner.userId, asset: "ETH", address: getAddress(tx.to), txHash: tx.hash, logIndex: 0, amount: tx.value, block: n });
        found++;
      }
    }
  }

  await setCheckpoint("ETH", to);
  return { ok: true, from, to, found };
}

/** Advance confirmations on pending deposits; credit the ledger once confirmed. */
export async function confirmEvmDeposits(): Promise<{ ok: boolean; credited: number; reason?: string }> {
  const cfg = await config();
  const provider = ethProvider(cfg);
  if (!provider) return { ok: false, credited: 0, reason: "no ETH RPC configured" };

  const required = Math.max(1, Number(cfg.SELF_CONFIRMATIONS ?? 12));
  const current = await provider.getBlockNumber();
  const pending = await db.select().from(cryptoDeposits)
    .where(and(eq(cryptoDeposits.network, "ETH"), inArray(cryptoDeposits.status, ["pending", "confirmed"])));

  let credited = 0;
  for (const d of pending) {
    const confs = Math.max(0, current - Number(d.blockNumber) + 1);
    if (confs >= required) {
      // Unique per (txHash, logIndex) so batched transfers never collapse.
      await creditCryptoDeposit({ userId: d.userId, asset: d.asset, network: "ETH", amount: BigInt(d.amount), txHash: `${d.txHash}:${d.logIndex}` });
      await db.update(cryptoDeposits).set({ status: "credited", confirmations: confs, creditedAt: new Date() }).where(eq(cryptoDeposits.id, d.id));
      credited++;
    } else {
      await db.update(cryptoDeposits).set({ status: "confirmed", confirmations: confs }).where(eq(cryptoDeposits.id, d.id));
    }
  }
  return { ok: true, credited };
}
