// Spurs Wallet funds fiat top-ups through Spurs Pay's private API via
// @spurs-cloud/pay (SpursPayInternal). This module keeps the original function
// names + shape so lib/topup.ts doesn't change.
import { SpursPayInternal } from "@spurs-cloud/pay";

// PAY_INTERNAL_URL overrides the SDK's baked-in production URL for local dev.
const pay = () => new SpursPayInternal({ baseUrl: process.env.PAY_INTERNAL_URL });

export interface PayPayment {
  reference: string;
  amount: number;
  currency: string;
  status: "pending" | "successful" | "failed";
  checkoutUrl: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
}

export async function createPayPayment(input: {
  merchant: string;
  amount: number;
  currency?: string;
  description?: string;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PayPayment> {
  return (await pay().createPayment(input)) as unknown as PayPayment;
}

export async function getPayPayment(reference: string): Promise<PayPayment | null> {
  return (await pay().getPayment(reference)) as unknown as PayPayment | null;
}

/* ----------------------- bank rails (withdrawals) ------------------------ */
// These use Pay's private endpoints directly — the published SDK doesn't cover
// them yet. Pay still hides which processor actually moves the money.

const PAY_BASE = (process.env.PAY_INTERNAL_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const INTERNAL = process.env.INTERNAL_API_SECRET ?? "";
const headers = { "x-internal-secret": INTERNAL, "Content-Type": "application/json", Accept: "application/json" };

export interface Bank { name: string; code: string }

export async function listBanks(): Promise<Bank[]> {
  const res = await fetch(`${PAY_BASE}/api/private/banks`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body?.banks) ? body.banks : [];
}

/** Name enquiry — confirms who owns an account before we save or pay it. */
export async function resolveBankAccount(bankCode: string, accountNumber: string): Promise<string | null> {
  const url = `${PAY_BASE}/api/private/banks?bankCode=${encodeURIComponent(bankCode)}&accountNumber=${encodeURIComponent(accountNumber)}`;
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return (await res.json())?.accountName ?? null;
}

export interface PayoutResult {
  reference: string;
  status: "successful" | "pending" | "failed";
  providerReference: string | null;
}

/** Send money out to a bank account through Pay's rails. */
export async function payoutToBank(input: {
  bankCode: string; accountNumber: string; accountName?: string;
  amount: number; currency?: string; narration?: string; reference?: string;
}): Promise<PayoutResult> {
  const res = await fetch(`${PAY_BASE}/api/private/payouts`, {
    method: "POST", headers, body: JSON.stringify({ ...input, mode: "live" }),
    cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Payout failed (${res.status})`);
  return body as PayoutResult;
}
