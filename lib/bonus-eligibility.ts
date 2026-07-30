/**
 * Pure decision for the first-deposit bonus — no DB, no config, no side effects,
 * so it's cheap to unit-test. The awarding side ({@link file://./bonus.ts}) reads
 * settings and writes the ledger; this just answers "does this deposit qualify?".
 */
export interface FirstDepositBonusRule {
  enabled: boolean;
  amountMinor: bigint;
  minMinor: bigint;
  baseCurrency: string;
}

export function qualifiesForFirstDepositBonus(
  rule: FirstDepositBonusRule,
  asset: string,
  depositMinor: bigint,
): boolean {
  if (!rule.enabled) return false;
  if (rule.amountMinor <= 0n) return false;
  // Bonus is defined in naira and paid in the base ledger currency only.
  if (asset !== rule.baseCurrency) return false;
  if (depositMinor < rule.minMinor) return false;
  return true;
}
