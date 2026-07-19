import { User, ShieldCheck, Coins, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ASSETS } from "@/lib/assets";
import { Card, PageHeader } from "@/components/wallet-ui";

const ACCOUNTS_URL = "http://localhost:8000/me";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Manage your wallet preferences and account." />

      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium"><User size={16} className="text-neutral-500" /> Profile</div>
        <div className="mt-4 grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <span className="text-neutral-500">Name</span><span>{user.name ?? "—"}</span>
          <span className="text-neutral-500">Email</span><span>{user.email ?? "—"}</span>
          <span className="text-neutral-500">User ID</span><span className="truncate font-mono text-xs text-neutral-500">{user.sub}</span>
        </div>
        <a href={ACCOUNTS_URL} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          Manage in Spurs Account <ExternalLink size={13} />
        </a>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium"><Coins size={16} className="text-neutral-500" /> Preferences</div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-neutral-500">Primary currency</span>
          <select defaultValue="NGN" className="input max-w-xs">
            {Object.values(ASSETS).map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-neutral-400">Shown on your overview. Naira is the default today.</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-neutral-500" /> Security</div>
        <p className="mt-3 text-sm text-neutral-500">
          Your sign-in, password and connected apps are managed by your Spurs account. Signing out here ends this
          wallet session only.
        </p>
        <div className="mt-4 flex gap-2">
          <a href={ACCOUNTS_URL} className="inline-flex h-9 items-center rounded-lg border border-neutral-300 px-4 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Security settings
          </a>
          <a href="/auth/logout" className="inline-flex h-9 items-center rounded-lg border border-red-500/40 bg-red-500/5 px-4 text-sm font-medium text-red-600 hover:bg-red-500/10 dark:text-red-300">
            Sign out
          </a>
        </div>
      </Card>
    </div>
  );
}
