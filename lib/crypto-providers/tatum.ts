import { getAsset } from "@/lib/assets";
import { chainOf, type CryptoProvider, type AddressResult, type WithdrawResult } from "./types";

/**
 * Tatum custody provider (https://tatum.io) — a real crypto infrastructure API.
 *
 * We keep OUR database as the ledger of record; Tatum handles the chain side:
 *  - deposit addresses are derived from a per-chain extended public key (xpub),
 *  - inbound deposits fire an ADDRESS_TRANSACTION webhook → /api/webhooks/crypto,
 *  - withdrawals are signed via Tatum KMS (a `signatureId`) and broadcast.
 *
 * All credentials come from the admin config store (app "wallet"), never env:
 *   CRYPTO_PROVIDER = tatum
 *   TATUM_API_KEY
 *   TATUM_XPUB_ETHEREUM / TATUM_XPUB_BITCOIN / TATUM_XPUB_TRON
 *   TATUM_SIGNATURE_ID              (KMS signature id for the hot wallet)
 *   SPURS_CRYPTO_WEBHOOK_URL        (public URL Tatum calls on deposits)
 */

const BASE = "https://api.tatum.io";
const USDT_ERC20 = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const SUB_CHAIN: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", tron: "TRON", solana: "SOL" };

type Cfg = Record<string, string | undefined>;

function minorToMajor(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function makeTatumProvider(cfg: Cfg): CryptoProvider {
  const get = (k: string) => (cfg[k]?.trim() || undefined);
  const xpubFor = (chain: string) => get(`TATUM_XPUB_${chain.toUpperCase()}`);
  const sigIdFor = (chain: string) => get(`TATUM_SIGID_${chain.toUpperCase()}`) ?? get("TATUM_SIGNATURE_ID");

  async function tatum<T>(path: string, init?: RequestInit): Promise<T> {
    const key = get("TATUM_API_KEY");
    if (!key) throw new Error("Tatum is not configured (TATUM_API_KEY missing in admin config)");
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "x-api-key": key, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(12_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Tatum ${res.status}: ${(body as { message?: string }).message ?? JSON.stringify(body)}`);
    return body as T;
  }

  return {
    id: "tatum",
    live: true,

    async createAddress({ asset, network, index }): Promise<AddressResult> {
      const chain = chainOf(asset, network);
      const xpub = xpubFor(chain);
      if (!xpub) throw new Error(`No xpub configured for ${chain} (TATUM_XPUB_${chain.toUpperCase()})`);

      const { address } = await tatum<{ address: string }>(`/v3/${chain}/address/${xpub}/${index}`);

      const url = get("SPURS_CRYPTO_WEBHOOK_URL");
      if (url) {
        await tatum(`/v3/subscription`, {
          method: "POST",
          body: JSON.stringify({ type: "ADDRESS_TRANSACTION", attr: { address, chain: SUB_CHAIN[chain], url } }),
        }).catch(() => { /* address still usable; deposits reconcilable later */ });
      }
      return { address, providerRef: `${chain}:${index}` };
    },

    async sendWithdrawal({ asset, network, toAddress, amount }): Promise<WithdrawResult> {
      const chain = chainOf(asset, network);
      const value = minorToMajor(amount, getAsset(asset).decimals);
      const signatureId = sigIdFor(chain);
      if (!signatureId) throw new Error(`No signing key configured for ${chain} (TATUM_SIGNATURE_ID)`);

      let res: { txId: string };
      if (asset === "USDT" && network === "ETH") {
        res = await tatum(`/v3/ethereum/erc20/transaction`, {
          method: "POST",
          body: JSON.stringify({ to: toAddress, amount: value, contractAddress: USDT_ERC20, digits: 6, signatureId }),
        });
      } else if (asset === "USDT" && network === "TRON") {
        res = await tatum(`/v3/tron/trc20/transaction`, {
          method: "POST",
          body: JSON.stringify({ to: toAddress, amount: value, tokenAddress: USDT_TRC20, feeLimit: 100, signatureId }),
        });
      } else if (chain === "ethereum") {
        res = await tatum(`/v3/ethereum/transaction`, {
          method: "POST",
          body: JSON.stringify({ to: toAddress, amount: value, currency: "ETH", signatureId }),
        });
      } else {
        throw new Error(`Live withdrawals for ${asset} on ${network} are not enabled on this provider yet`);
      }
      return { txHash: res.txId, status: "pending" };
    },
  };
}
