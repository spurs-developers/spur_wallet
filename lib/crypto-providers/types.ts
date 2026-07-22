/**
 * Crypto custody provider abstraction. The provider owns the chain side:
 * issuing deposit addresses, broadcasting withdrawals, and (via webhooks)
 * notifying us of inbound deposits. Our own DB stays the ledger of record.
 */
export interface AddressResult {
  address: string;
  memo?: string | null;       // destination tag/memo where the chain needs one
  providerRef?: string | null; // provider-side id/handle for the address
}

export interface WithdrawResult {
  txHash: string;
  status: "sent" | "pending" | "confirmed";
}

export interface CryptoProvider {
  readonly id: string;
  /** True for a real custody provider; false for the sandbox stand-in. */
  readonly live: boolean;

  /** Issue (or derive) a deposit address for a user on an asset + network. */
  createAddress(input: { userId: string; asset: string; network: string; index: number }): Promise<AddressResult>;

  /** Broadcast an on-chain withdrawal to an external address. */
  sendWithdrawal(input: {
    asset: string;
    network: string;
    toAddress: string;
    amount: bigint; // exact minor units
    reference: string;
  }): Promise<WithdrawResult>;
}

/** Tatum/most chains identify the network by these slugs. */
export function chainOf(asset: string, network: string): "bitcoin" | "ethereum" | "tron" | "solana" {
  if (network === "BTC") return "bitcoin";
  if (network === "TRON") return "tron";
  if (network === "SOL") return "solana";
  return "ethereum"; // ETH native + ERC-20 tokens (e.g. USDT-ERC20)
}
