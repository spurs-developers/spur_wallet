import { JsonRpcProvider, HDNodeWallet, Contract, getAddress } from "ethers";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { cryptoAddresses } from "@/lib/db/schema";
import { getAdminConfig } from "@/lib/admin-config";

/**
 * Consolidate confirmed deposits from per-user derived addresses into the pooled
 * hot wallet, so the hot wallet can fund withdrawals. Self-hosted EVM only.
 *
 * ERC-20 sweeps need gas on the deposit address, so we first send it a little ETH
 * from the hot wallet (the "gas station"), then move the token. This is opt-in
 * (SELF_SWEEP=true) and MUST be validated on a testnet before mainnet — it moves
 * real funds and awaits on-chain confirmations.
 */

const USDT_MAINNET = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ERC20 = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export interface SweepResult { address: string; asset: string; txHash?: string; skipped?: string; error?: string }

export async function sweepEvmDeposits(): Promise<{ ok: boolean; swept: SweepResult[]; reason?: string }> {
  const cfg: Record<string, string | undefined> = { ...process.env, ...(await getAdminConfig()) };
  const rpc = cfg.SELF_RPC_ETHEREUM?.trim();
  const mnemonic = cfg.SELF_MNEMONIC?.trim();
  if (!rpc || !mnemonic) return { ok: false, swept: [], reason: "self-hosted ETH RPC / mnemonic not configured" };
  if ((cfg.SELF_SWEEP ?? "false").toLowerCase() !== "true") return { ok: false, swept: [], reason: "sweeping disabled (set SELF_SWEEP=true)" };

  const provider = new JsonRpcProvider(rpc);
  const hot = HDNodeWallet.fromPhrase(mnemonic, "", cfg.SELF_HOT_PATH ?? "m/44'/60'/0'/0/0").connect(provider);
  const usdtAddr = cfg.SELF_USDT_CONTRACT_ETHEREUM?.trim() || USDT_MAINNET;

  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;

  const addrs = await db.select().from(cryptoAddresses)
    .where(and(eq(cryptoAddresses.network, "ETH"), isNotNull(cryptoAddresses.providerRef)));

  const swept: SweepResult[] = [];
  for (const a of addrs) {
    const idx = Number((a.providerRef ?? "").split(":")[1]);
    if (!Number.isInteger(idx)) continue;
    const dep = HDNodeWallet.fromPhrase(mnemonic, "", `m/44'/60'/0'/0/${idx}`).connect(provider);

    try {
      if (a.asset === "ETH") {
        const bal = await provider.getBalance(dep.address);
        const cost = 21000n * gasPrice;
        if (bal <= cost) { swept.push({ address: a.address, asset: "ETH", skipped: "dust" }); continue; }
        const tx = await dep.sendTransaction({ to: hot.address, value: bal - cost });
        swept.push({ address: a.address, asset: "ETH", txHash: tx.hash });
      } else if (a.asset === "USDT") {
        const token = new Contract(usdtAddr, ERC20, dep);
        const tbal: bigint = await token.balanceOf(dep.address);
        if (tbal <= 0n) { swept.push({ address: a.address, asset: "USDT", skipped: "empty" }); continue; }
        const gasNeed = 70000n * gasPrice;
        const ethBal = await provider.getBalance(dep.address);
        if (ethBal < gasNeed) {
          const fund = await hot.sendTransaction({ to: getAddress(dep.address), value: gasNeed - ethBal });
          await fund.wait(1); // deposit address now has gas
        }
        const tx = await token.transfer(hot.address, tbal);
        swept.push({ address: a.address, asset: "USDT", txHash: tx.hash });
      }
    } catch (e) {
      swept.push({ address: a.address, asset: a.asset, error: e instanceof Error ? e.message : "sweep failed" });
    }
  }
  return { ok: true, swept };
}
