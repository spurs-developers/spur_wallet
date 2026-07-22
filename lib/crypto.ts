import { randomBytes } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cryptoAddresses, cryptoWithdrawals, type CryptoAddress, type CryptoWithdrawal } from "@/lib/db/schema";
import { getAsset } from "@/lib/assets";
import { creditOnce, credit, debit } from "@/lib/wallet";
import { resolveCryptoProvider } from "@/lib/crypto-providers";

export interface Network {
  id: string;    // BTC | ETH | TRON | SOL
  label: string;
  token?: boolean;   // true when the asset is a token on this chain (has a contract)
  contract?: string; // the token's contract address on this network
}

/** Supported networks per crypto asset. Token assets (USDT) carry the contract. */
export const NETWORKS: Record<string, Network[]> = {
  BTC: [{ id: "BTC", label: "Bitcoin" }],
  ETH: [{ id: "ETH", label: "Ethereum (ERC-20)" }],
  USDT: [
    { id: "TRON", label: "Tron (TRC-20)", token: true, contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
    { id: "ETH", label: "Ethereum (ERC-20)", token: true, contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  ],
  SOL: [{ id: "SOL", label: "Solana" }],
};

export function networksFor(asset: string): Network[] {
  return NETWORKS[asset] ?? [];
}
export function networkInfo(asset: string, network: string): Network | undefined {
  return networksFor(asset).find((n) => n.id === network);
}

/** Flat network fee per asset, in minor units (paid on withdrawal). */
const NETWORK_FEE: Record<string, bigint> = {
  BTC: 20000n, ETH: 300000000000000n, USDT: 1000000n, SOL: 5000000n,
};
export function networkFee(asset: string): bigint {
  return NETWORK_FEE[asset] ?? 0n;
}

function assertCrypto(asset: string, network: string) {
  if (getAsset(asset).kind !== "crypto") throw new Error(`${asset} is not a crypto asset`);
  if (!networksFor(asset).some((n) => n.id === network)) throw new Error(`${network} is not available for ${asset}`);
}

/** Get (or issue via the custody provider) the user's deposit address for asset + network. */
export async function getOrCreateAddress(userId: string, asset: string, network: string): Promise<CryptoAddress> {
  assertCrypto(asset, network);
  const [existing] = await db
    .select().from(cryptoAddresses)
    .where(and(eq(cryptoAddresses.userId, userId), eq(cryptoAddresses.asset, asset), eq(cryptoAddresses.network, network)))
    .limit(1);
  if (existing) return existing;

  const provider = await resolveCryptoProvider();
  // Derivation index for HD custody wallets: next address on this network.
  const [{ n }] = await db.select({ n: count() }).from(cryptoAddresses).where(eq(cryptoAddresses.network, network));
  const result = await provider.createAddress({ userId, asset, network, index: Number(n ?? 0) });

  const [created] = await db
    .insert(cryptoAddresses)
    .values({ userId, asset, network, address: result.address, memo: result.memo ?? null, provider: provider.id, providerRef: result.providerRef ?? null })
    .returning();
  return created;
}

export async function listAddresses(userId: string): Promise<CryptoAddress[]> {
  return db.select().from(cryptoAddresses).where(eq(cryptoAddresses.userId, userId));
}

export async function listWithdrawals(userId: string, limit = 50): Promise<CryptoWithdrawal[]> {
  return db.select().from(cryptoWithdrawals).where(eq(cryptoWithdrawals.userId, userId)).orderBy(desc(cryptoWithdrawals.createdAt)).limit(limit);
}

/** Send crypto on-chain via the custody provider: reserve funds, broadcast, then
 *  record — refunding the ledger if the broadcast fails. */
export async function withdrawCrypto(
  userId: string,
  input: { asset: string; network: string; toAddress: string; amount: bigint },
): Promise<CryptoWithdrawal> {
  assertCrypto(input.asset, input.network);
  if (input.amount <= 0n) throw new Error("Amount must be positive");
  if (!input.toAddress || input.toAddress.length < 12) throw new Error("Enter a valid destination address");

  const fee = networkFee(input.asset);
  const reference = "wcw_" + randomBytes(10).toString("hex");
  const total = input.amount + fee;

  // Reserve funds (throws if the balance can't cover amount + network fee).
  await debit(userId, input.asset, total, {
    source: "withdrawal",
    reference,
    description: `Withdraw ${input.asset} to ${input.toAddress.slice(0, 10)}…`,
  });

  const provider = await resolveCryptoProvider();
  let result;
  try {
    result = await provider.sendWithdrawal({
      asset: input.asset, network: input.network, toAddress: input.toAddress, amount: input.amount, reference,
    });
  } catch (e) {
    // Broadcast failed — return the reserved funds and record the failure.
    await credit(userId, input.asset, total, {
      source: "withdrawal", relatedRef: reference, description: `Reversed withdrawal (${(e as Error).message})`,
    });
    await db.insert(cryptoWithdrawals).values({
      userId, reference, asset: input.asset, network: input.network, toAddress: input.toAddress,
      amount: input.amount.toString(), fee: fee.toString(), status: "failed",
    });
    throw e;
  }

  const [w] = await db
    .insert(cryptoWithdrawals)
    .values({
      userId, reference, asset: input.asset, network: input.network, toAddress: input.toAddress,
      amount: input.amount.toString(), fee: fee.toString(), status: result.status, txHash: result.txHash,
    })
    .returning();
  return w;
}

/** Credit a detected on-chain deposit (idempotent by tx hash). Called by the custody webhook. */
export async function creditCryptoDeposit(
  input: { userId: string; asset: string; network: string; amount: bigint; txHash: string },
) {
  return creditOnce(input.userId, input.asset, input.amount, {
    source: "crypto_deposit",
    relatedRef: input.txHash,
    description: `Deposit on ${input.network}`,
  });
}
