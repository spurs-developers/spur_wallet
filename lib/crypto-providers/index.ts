import { getAdminConfig } from "@/lib/admin-config";
import { sandboxProvider } from "./sandbox";
import { makeTatumProvider } from "./tatum";
import { makeSelfHostedProvider } from "./selfhosted";
import type { CryptoProvider } from "./types";

export type { CryptoProvider } from "./types";

/**
 * Pick the crypto custody provider from admin config (CRYPTO_PROVIDER). All
 * provider credentials come from the admin store; env is only a last-resort
 * fallback. Defaults to the sandbox provider when nothing real is configured.
 *
 *   sandbox    — simulated, no chain
 *   tatum      — hosted custody API
 *   selfhosted — your own keys + your own node (no third-party custody)
 */
export async function resolveCryptoProvider(): Promise<CryptoProvider> {
  const cfg = await getAdminConfig();
  const merged: Record<string, string | undefined> = { ...process.env, ...cfg };
  const pick = (merged.CRYPTO_PROVIDER ?? "sandbox").toLowerCase();

  if (pick === "tatum") return makeTatumProvider(merged);
  if (pick === "selfhosted" || pick === "self-hosted") return makeSelfHostedProvider(merged);
  return sandboxProvider;
}
