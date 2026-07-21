import { redirect } from "next/navigation";
import { getSpursUser, spurs } from "@spurs-cloud/accounts/next";
import type { SpursUser } from "@spurs-cloud/accounts";
import { db, spursUsers } from "@/lib/db";

/**
 * Auth is the shared Spurs session — one cookie issued by accounts covers every
 * Spurs app. All the OIDC/PKCE plumbing lives in `@spurs-cloud/accounts`.
 */
export type Session = SpursUser;

/** Current Spurs user in a server component / action, or null. */
export async function getSession(): Promise<Session | null> {
  return getSpursUser();
}

/**
 * Wallet rows are foreign-keyed to `spurs.users`, so make sure the shared user
 * row exists before we touch balances. Cheap and idempotent.
 */
async function ensureSpursUser(user: SpursUser): Promise<void> {
  await db
    .insert(spursUsers)
    .values({ id: user.sub, name: user.name ?? null, email: user.email ?? null })
    .onConflictDoNothing();
}

/** Like getSession but bounces to Spurs Accounts when signed out. */
export async function requireUser(): Promise<Session> {
  const user = await getSession();
  if (!user) redirect(spurs().loginUrl(`${process.env.APP_URL}/dashboard`));
  await ensureSpursUser(user);
  return user;
}
