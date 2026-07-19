// Signed session cookie for Spurs Wallet (HS256 JWT via jose).
import { SignJWT, jwtVerify } from "jose";
import type { SpursUser } from "./oidc";

export const SESSION_COOKIE = "spurs_wallet_session";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-insecure-secret-change-me-32ch",
);

export interface Session {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
}

export async function createSession(user: SpursUser): Promise<string> {
  return new SignJWT({
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      name: payload.name as string | undefined,
      email: payload.email as string | undefined,
      email_verified: payload.email_verified as boolean | undefined,
    };
  } catch {
    return null;
  }
}
