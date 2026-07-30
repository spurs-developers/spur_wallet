import "server-only";
import { creditOnce } from "@/lib/wallet";
import { getWalletSettings } from "@/lib/settings";
import { qualifiesForFirstDepositBonus } from "@/lib/bonus-eligibility";

const toMinor = (x: string | number | bigint): bigint =>
  typeof x === "bigint" ? x : BigInt(Math.round(Number(x)));

/**
 * Award the first-deposit bonus, if the platform has one switched on. Called
 * right after a real deposit is credited. It is:
 *   - once per user — idempotent on reference `first-deposit:{userId}`, so only
 *     the user's first qualifying deposit ever pays out; later ones no-op;
 *   - base-currency only (NGN) — the admin sets the amount in naira;
 *   - gated by a minimum qualifying deposit.
 *
 * Best-effort: never throws into the deposit flow. A failure here must not undo
 * or block the user's actual deposit.
 */
export async function maybeAwardFirstDeposit(
  userId: string,
  asset: string,
  depositAmount: string | number | bigint,
): Promise<void> {
  try {
    const s = await getWalletSettings();
    const rule = {
      enabled: s.firstDepositBonusEnabled,
      amountMinor: s.firstDepositBonusMinor,
      minMinor: s.firstDepositBonusMinMinor,
      baseCurrency: s.baseCurrency,
    };
    if (!qualifiesForFirstDepositBonus(rule, asset, toMinor(depositAmount))) return;

    await creditOnce(userId, s.baseCurrency, s.firstDepositBonusMinor, {
      source: "signup_bonus",
      relatedRef: `first-deposit:${userId}`,
      description: "First-deposit bonus",
    });
  } catch {
    // swallow — the deposit itself already succeeded
  }
}
