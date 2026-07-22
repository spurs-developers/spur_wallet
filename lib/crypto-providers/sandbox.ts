import { randomBytes } from "node:crypto";
import type { CryptoProvider, AddressResult, WithdrawResult } from "./types";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += B58[bytes[i] % B58.length];
  return s;
}
function hex(len: number): string {
  return randomBytes(Math.ceil(len / 2)).toString("hex").slice(0, len);
}

function generateAddress(network: string): string {
  switch (network) {
    case "BTC": return "bc1q" + hex(38);
    case "ETH": return "0x" + hex(40);
    case "TRON": return "T" + b58(33);
    case "SOL": return b58(43);
    default: return b58(40);
  }
}

/** Simulated custody: plausible addresses + instant "broadcast". No real chain. */
export const sandboxProvider: CryptoProvider = {
  id: "sandbox",
  live: false,

  async createAddress({ network }): Promise<AddressResult> {
    return { address: generateAddress(network), providerRef: "sandbox" };
  },

  async sendWithdrawal({ network }): Promise<WithdrawResult> {
    const txHash = (network === "ETH" ? "0x" : "") + hex(64);
    return { txHash, status: "sent" };
  },
};
