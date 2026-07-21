"use client";

import { SpursAccountMenu } from "@spurs-cloud/accounts/react";

/**
 * The shared Spurs account avatar, branded for Wallet (emerald). The component
 * itself lives in `@spurs-cloud/accounts` so every Spurs app shows the same menu.
 */
export default function AccountMenu({ name, email }: { name?: string; email?: string }) {
  return (
    <SpursAccountMenu
      user={{ name, email }}
      accent="#10b981"
      accentTo="#0d9488"
      signOutUrl="/auth/logout"
    />
  );
}
