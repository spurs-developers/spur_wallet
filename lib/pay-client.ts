// Spurs Wallet funds fiat top-ups through Spurs Pay's private API. The Wallet is
// a trusted service, so it authenticates with the shared INTERNAL_API_SECRET.
const PAY_URL = process.env.PAY_INTERNAL_URL ?? "http://localhost:3100";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";

export interface PayPayment {
  reference: string;
  amount: number;
  currency: string;
  status: "pending" | "successful" | "failed";
  checkoutUrl: string;
  metadata: Record<string, unknown>;
  paidAt: string | null;
}

async function payFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${PAY_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-internal-secret": SECRET, ...(init.headers ?? {}) },
    cache: "no-store",
  });
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
  const res = await payFetch("/api/private/payments", { method: "POST", body: JSON.stringify(input) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Spurs Pay request failed");
  return json.data;
}

export async function getPayPayment(reference: string): Promise<PayPayment | null> {
  const res = await payFetch(`/api/private/payments?reference=${encodeURIComponent(reference)}`, { method: "GET" });
  if (res.status === 404) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Spurs Pay request failed");
  return json.data;
}
