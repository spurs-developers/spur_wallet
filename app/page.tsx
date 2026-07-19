import { redirect } from "next/navigation";
import { Wallet, ArrowLeftRight, ShieldCheck, Coins, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth";

export default async function Landing() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="flex-1 bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <a href="/auth/start" className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700">
            Sign in
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-16 pt-20 text-center sm:px-8 sm:pt-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Naira today · dollars &amp; crypto coming
        </span>
        <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          One wallet for everything on Spurs
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          Hold your balance, top up in seconds, and pay across every Spurs Cloud product — all from one account you
          already have.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <a href="/auth/start" className="flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-medium text-white transition hover:bg-emerald-700">
            Continue with Spurs <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-24 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature icon={<Coins size={19} />} title="Hold any currency">
            Keep Naira now, with dollars and crypto on the way — each balance side by side.
          </Feature>
          <Feature icon={<ArrowLeftRight size={19} />} title="Top up & spend">
            Add money with card, bank transfer or USSD, then pay across Spurs products instantly.
          </Feature>
          <Feature icon={<ShieldCheck size={19} />} title="Secure by default">
            One Spurs sign-in, an exact ledger behind every balance, and no card details to manage.
          </Feature>
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-8 text-sm text-neutral-500 sm:px-8">
          <Brand />
          <span>Part of Spurs Cloud</span>
        </div>
      </footer>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-600 text-white"><Wallet size={14} /></span>
      Spurs Wallet
    </span>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-5 text-left dark:border-neutral-800">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">{icon}</span>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{children}</p>
    </div>
  );
}
