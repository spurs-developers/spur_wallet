import { HDNodeWallet, JsonRpcProvider, Contract, isAddress } from "ethers";
import { chainOf, type CryptoProvider, type AddressResult, type WithdrawResult } from "./types";

/**
 * Self-hosted custody — no third-party custody API. Keys, HD address derivation
 * and transaction signing all happen in-process from a mnemonic you hold; the
 * only outside dependency is an Ethereum RPC endpoint, which can be YOUR OWN
 * node (geth/erigon). Nothing custodial ever leaves your infrastructure.
 *
 * EVM-first (ETH + ERC-20 USDT). Bitcoin/Tron/Solana would each need their own
 * signing lib + node; they throw clearly here until added.
 *
 * Config (from the admin store, app "wallet"):
 *   CRYPTO_PROVIDER = selfhosted
 *   SELF_MNEMONIC                 (BIP-39 seed — derives deposit + hot wallets)
 *   SELF_RPC_ETHEREUM             (your node's JSON-RPC URL)
 *   SELF_HOT_PATH                 (default m/44'/60'/0'/0/0 — the pooled hot wallet)
 *   SELF_USDT_CONTRACT_ETHEREUM   (defaults to mainnet USDT)
 */

type Cfg = Record<string, string | undefined>;
const USDT_MAINNET = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

export function makeSelfHostedProvider(cfg: Cfg): CryptoProvider {
  const get = (k: string) => (cfg[k]?.trim() || undefined);
  const mnemonic = () => {
    const m = get("SELF_MNEMONIC");
    if (!m) throw new Error("Self-hosted custody needs SELF_MNEMONIC in admin config");
    return m;
  };
  const rpc = (chain: string) => {
    const url = get(`SELF_RPC_${chain.toUpperCase()}`);
    if (!url) throw new Error(`No RPC configured for ${chain} (SELF_RPC_${chain.toUpperCase()})`);
    return new JsonRpcProvider(url);
  };
  const ensureEvm = (asset: string, network: string) => {
    if (chainOf(asset, network) !== "ethereum") {
      throw new Error(`Self-hosted provider currently supports EVM (ETH, USDT-ERC20) only — ${asset} on ${network} is not enabled`);
    }
  };

  return {
    id: "selfhosted",
    live: true,

    async createAddress({ asset, network, index }): Promise<AddressResult> {
      ensureEvm(asset, network);
      // Local HD derivation — a unique deposit address per user, no network call.
      const wallet = HDNodeWallet.fromPhrase(mnemonic(), "", `m/44'/60'/0'/0/${index + 1}`);
      return { address: wallet.address, providerRef: `ethereum:${index + 1}` };
    },

    async sendWithdrawal({ asset, network, toAddress, amount }): Promise<WithdrawResult> {
      ensureEvm(asset, network);
      if (!isAddress(toAddress)) throw new Error("Invalid EVM destination address");

      const provider = rpc("ethereum");
      const hotPath = get("SELF_HOT_PATH") ?? "m/44'/60'/0'/0/0";
      const hot = HDNodeWallet.fromPhrase(mnemonic(), "", hotPath).connect(provider);

      let txHash: string;
      if (asset === "USDT") {
        const contract = get("SELF_USDT_CONTRACT_ETHEREUM") ?? USDT_MAINNET;
        const erc20 = new Contract(contract, ERC20_ABI, hot);
        const tx = await erc20.transfer(toAddress, amount); // amount already in token base units (6dp)
        txHash = tx.hash;
      } else {
        // Native ETH: our minor units are wei (18dp), so value = amount as-is.
        const tx = await hot.sendTransaction({ to: toAddress, value: amount });
        txHash = tx.hash;
      }
      return { txHash, status: "pending" };
    },
  };
}
