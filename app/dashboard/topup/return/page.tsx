import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { finalizeTopup } from "@/lib/topup";
import { formatAsset } from "@/lib/assets";

// Spurs Pay sends the customer back here (?ref=...) after checkout. Confirm + credit.
export default async function TopupReturn({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  await requireUser();
  const { ref } = await searchParams;

  const result = ref ? await finalizeTopup(ref) : { status: "failed" as const };

  const view =
    result.status === "successful"
      ? {
          icon: <CheckCircle2 className="text-emerald-500" size={44} />,
          title: "Top-up successful",
          body: `${formatAsset(result.amount, result.asset)} was added to your wallet.`,
        }
      : result.status === "pending"
        ? {
            icon: <Clock className="text-amber-500" size={44} />,
            title: "Payment pending",
            body: "We'll add the funds as soon as your payment clears.",
          }
        : {
            icon: <XCircle className="text-red-500" size={44} />,
            title: "Top-up not completed",
            body: "No funds were added. You can try again.",
          };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-neutral-50 px-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="flex justify-center">{view.icon}</div>
        <h1 className="mt-4 text-lg font-semibold">{view.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{view.body}</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
          Back to wallet
        </Link>
      </div>
    </div>
  );
}
