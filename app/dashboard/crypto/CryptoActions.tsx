"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Copy, Check, Loader2, FlaskConical, Info } from "lucide-react";
import { createAddressAction, withdrawCryptoAction, simulateDepositAction } from "../actions";

interface Net { id: string; label: string; token?: boolean; contract?: string }
interface CAsset { code: string; name: string; symbol: string; networks: Net[] }

const input = "h-10 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-neutral-700";
const label = "mb-1.5 block text-xs font-medium text-neutral-500";

export default function CryptoActions({ assets, sandbox }: { assets: CAsset[]; sandbox: boolean }) {
  const [tab, setTab] = useState<"receive" | "send" | "test">("receive");
  const tabs = [
    { id: "receive" as const, label: "Receive", icon: ArrowDownToLine },
    { id: "send" as const, label: "Send", icon: ArrowUpFromLine },
    ...(sandbox ? [{ id: "test" as const, label: "Test deposit", icon: FlaskConical }] : []),
  ];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 inline-flex rounded-lg border border-neutral-200 p-0.5 text-sm dark:border-neutral-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${tab === t.id ? "bg-indigo-600 text-white" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "receive" && <Receive assets={assets} />}
      {tab === "send" && <Send assets={assets} />}
      {tab === "test" && <TestDeposit assets={assets} />}
    </div>
  );
}

function useAssetNetwork(assets: CAsset[]) {
  const [asset, setAsset] = useState(assets[0]?.code ?? "");
  const nets = useMemo(() => assets.find((a) => a.code === asset)?.networks ?? [], [assets, asset]);
  const [network, setNetwork] = useState(nets[0]?.id ?? "");
  const pickAsset = (code: string) => {
    setAsset(code);
    const first = assets.find((a) => a.code === code)?.networks[0]?.id ?? "";
    setNetwork(first);
  };
  const net = nets.find((n) => n.id === network);
  return { asset, network, nets, net, pickAsset, setNetwork };
}

function AssetNetwork({ assets, s }: { assets: CAsset[]; s: ReturnType<typeof useAssetNetwork> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className={label}>Asset</span>
        <select className={input} value={s.asset} onChange={(e) => s.pickAsset(e.target.value)}>
          {assets.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
        </select>
      </label>
      <label className="block">
        <span className={label}>Network</span>
        <select className={input} value={s.network} onChange={(e) => s.setNetwork(e.target.value)}>
          {s.nets.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </label>
    </div>
  );
}

function ContractNote({ net, asset }: { net?: Net; asset: string }) {
  if (!net?.token || !net.contract) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <Info size={13} className="mt-0.5 shrink-0" />
      <span>Send only <b>{asset}</b> on <b>{net.label}</b>. Token contract <span className="font-mono break-all">{net.contract}</span>.</span>
    </div>
  );
}

function Copyable({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
      {done ? <Check size={13} /> : <Copy size={13} />} Copy
    </button>
  );
}

function Receive({ assets }: { assets: CAsset[] }) {
  const s = useAssetNetwork(assets);
  const [pending, start] = useTransition();
  const [addr, setAddr] = useState<{ address: string; memo: string | null; contract: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const gen = () => start(async () => {
    setErr(null); setAddr(null);
    const res = await createAddressAction(s.asset, s.network);
    if (res.ok) setAddr({ address: res.address, memo: res.memo, contract: res.contract });
    else setErr(res.error);
  });

  return (
    <div className="space-y-4">
      <AssetNetwork assets={assets} s={s} />
      <ContractNote net={s.net} asset={s.asset} />
      <button onClick={gen} disabled={pending} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <ArrowDownToLine size={15} />} Show deposit address
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {addr && (
        <div className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <span className={label}>Your {s.asset} deposit address ({s.net?.label})</span>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-2 py-1.5 text-xs dark:bg-neutral-800">{addr.address}</code>
            <Copyable value={addr.address} />
          </div>
          {addr.memo && <p className="text-xs text-neutral-500">Memo/Tag: <span className="font-mono">{addr.memo}</span></p>}
          <p className="text-xs text-neutral-500">Only send {s.asset} on {s.net?.label} to this address.</p>
        </div>
      )}
    </div>
  );
}

function Send({ assets }: { assets: CAsset[] }) {
  const s = useAssetNetwork(assets);
  const [pending, start] = useTransition();
  const [toAddress, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = () => start(async () => {
    setMsg(null);
    const res = await withdrawCryptoAction({ asset: s.asset, network: s.network, toAddress, amount });
    if (res.ok) { setMsg({ ok: true, text: `Sent · ${res.reference} · tx ${res.txHash?.slice(0, 14)}…` }); setTo(""); setAmount(""); }
    else setMsg({ ok: false, text: res.error });
  });

  return (
    <div className="space-y-4">
      <AssetNetwork assets={assets} s={s} />
      <ContractNote net={s.net} asset={s.asset} />
      <label className="block">
        <span className={label}>Destination address</span>
        <input className={`${input} font-mono`} value={toAddress} onChange={(e) => setTo(e.target.value)} placeholder="Paste the recipient's on-chain address" />
      </label>
      <label className="block">
        <span className={label}>Amount ({s.asset})</span>
        <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <span className="mt-1 block text-xs text-neutral-400">A network fee is deducted on top of the amount.</span>
      </label>
      <button onClick={send} disabled={pending || !toAddress || !amount} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpFromLine size={15} />} Send {s.asset}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}

function TestDeposit({ assets }: { assets: CAsset[] }) {
  const s = useAssetNetwork(assets);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const go = () => start(async () => {
    setMsg(null);
    const res = await simulateDepositAction({ asset: s.asset, network: s.network, amount });
    if (res.ok) { setMsg({ ok: true, text: `Simulated deposit credited.` }); setAmount(""); }
    else setMsg({ ok: false, text: res.error });
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">Sandbox only — credits your wallet as if a deposit landed on-chain, so you can test the flow.</p>
      <AssetNetwork assets={assets} s={s} />
      <label className="block">
        <span className={label}>Amount ({s.asset})</span>
        <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </label>
      <button onClick={go} disabled={pending || !amount} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-neutral-300 px-5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
        {pending ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />} Simulate deposit
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
