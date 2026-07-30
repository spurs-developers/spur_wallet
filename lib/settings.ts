import "server-only";
import { getAdminConfig } from "@/lib/admin-config";

/**
 * Wallet's platform settings, served from the admin control plane. These are
 * enforced for real: funding limits, transfer/convert switches, fees, which
 * assets may be held. Falls back to safe defaults if admin is unreachable.
 */
export interface WalletSettings {
  enabledAssets: string[];
  baseCurrency: string;
  topupEnabled: boolean;
  minTopupMinor: bigint;      // NGN minor units
  vaEnabled: boolean;
  sendEnabled: boolean;
  convertEnabled: boolean;
  dailySendLimitMinor: bigint; // NGN minor units (0 = unlimited)
  sendFeeFlatMinor: bigint;    // NGN minor units
  convertFeePercent: number;
  kycRequired: boolean;
  // First-deposit bonus: credited once, the first time a user funds their
  // wallet with a qualifying deposit. Amounts in NGN minor units.
  firstDepositBonusEnabled: boolean;
  firstDepositBonusMinor: bigint;
  firstDepositBonusMinMinor: bigint;
}

const bool = (v: string | undefined, d: boolean) => (v == null ? d : v === "true" || v === "1" || v === "on");
const num = (v: string | undefined, d: number) => (v == null || v === "" ? d : Number(v) || 0);

export async function getWalletSettings(): Promise<WalletSettings> {
  const c = await getAdminConfig();
  const assets = (c.WALLET_ENABLED_ASSETS ?? "NGN,USD,USDT,BTC,ETH,SOL")
    .split(",").map((s) => s.trim()).filter(Boolean);

  return {
    // NGN is always spendable — it's the base ledger currency.
    enabledAssets: assets.includes("NGN") ? assets : ["NGN", ...assets],
    baseCurrency: c.WALLET_BASE_CURRENCY ?? "NGN",
    topupEnabled: bool(c.WALLET_TOPUP_ENABLED, true),
    minTopupMinor: BigInt(Math.round(num(c.WALLET_MIN_TOPUP, 100) * 100)),
    vaEnabled: bool(c.WALLET_VA_ENABLED, true),
    sendEnabled: bool(c.WALLET_SEND_ENABLED, true),
    convertEnabled: bool(c.WALLET_CONVERT_ENABLED, true),
    dailySendLimitMinor: BigInt(Math.round(num(c.WALLET_DAILY_SEND_LIMIT, 5_000_000) * 100)),
    sendFeeFlatMinor: BigInt(Math.round(num(c.WALLET_SEND_FEE_FLAT, 0) * 100)),
    convertFeePercent: num(c.WALLET_CONVERT_FEE_PERCENT, 0.5),
    kycRequired: bool(c.WALLET_KYC_REQUIRED, false),
    firstDepositBonusEnabled: bool(c.WALLET_FIRST_DEPOSIT_BONUS_ENABLED, false),
    firstDepositBonusMinor: BigInt(Math.round(num(c.WALLET_FIRST_DEPOSIT_BONUS, 0) * 100)),
    firstDepositBonusMinMinor: BigInt(Math.round(num(c.WALLET_FIRST_DEPOSIT_BONUS_MIN, 0) * 100)),
  };
}

export function assertAssetEnabled(s: WalletSettings, asset: string) {
  if (!s.enabledAssets.includes(asset)) {
    throw new Error(`${asset} is not available on this platform right now`);
  }
}
