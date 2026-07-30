import { describe, it, expect } from "vitest";
import { qualifiesForFirstDepositBonus, type FirstDepositBonusRule } from "./bonus-eligibility";

const rule = (over: Partial<FirstDepositBonusRule> = {}): FirstDepositBonusRule => ({
  enabled: true,
  amountMinor: 100_000n, // ₦1,000
  minMinor: 50_000n,     // ₦500 minimum
  baseCurrency: "NGN",
  ...over,
});

describe("qualifiesForFirstDepositBonus", () => {
  it("qualifies for a base-currency deposit over the minimum", () => {
    expect(qualifiesForFirstDepositBonus(rule(), "NGN", 200_000n)).toBe(true);
  });

  it("qualifies exactly at the minimum", () => {
    expect(qualifiesForFirstDepositBonus(rule(), "NGN", 50_000n)).toBe(true);
  });

  it("does not qualify below the minimum", () => {
    expect(qualifiesForFirstDepositBonus(rule(), "NGN", 49_999n)).toBe(false);
  });

  it("does not qualify when the program is off", () => {
    expect(qualifiesForFirstDepositBonus(rule({ enabled: false }), "NGN", 200_000n)).toBe(false);
  });

  it("does not qualify when the bonus amount is zero", () => {
    expect(qualifiesForFirstDepositBonus(rule({ amountMinor: 0n }), "NGN", 200_000n)).toBe(false);
  });

  it("does not qualify for a non-base currency (e.g. crypto/USD)", () => {
    expect(qualifiesForFirstDepositBonus(rule(), "USDT", 200_000n)).toBe(false);
    expect(qualifiesForFirstDepositBonus(rule(), "BTC", 200_000n)).toBe(false);
  });

  it("respects a custom base currency", () => {
    expect(qualifiesForFirstDepositBonus(rule({ baseCurrency: "USD" }), "USD", 200_000n)).toBe(true);
    expect(qualifiesForFirstDepositBonus(rule({ baseCurrency: "USD" }), "NGN", 200_000n)).toBe(false);
  });
});
