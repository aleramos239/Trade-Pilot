"use client";

import { Landmark, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BrokerPlatform, DiscoveredBrokerAccount } from "@/lib/trading/types";

const platforms: BrokerPlatform[] = ["Tradovate", "Rithmic", "ProjectX"];

export function AccountSetupPanel({
  discoveredBrokerAccounts,
}: {
  discoveredBrokerAccounts: DiscoveredBrokerAccount[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [platform, setPlatform] = useState<BrokerPlatform>("Tradovate");
  const [role, setRole] = useState<"leader" | "follower">("follower");
  const [balance, setBalance] = useState("");
  const [maxDailyLoss, setMaxDailyLoss] = useState("");
  const [trailingDrawdownLimit, setTrailingDrawdownLimit] = useState("");
  const [multiplier, setMultiplier] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");

  async function createAccount(discoveredAccountId?: string) {
    setMessage("");
    setError("");
    setPendingId(discoveredAccountId ?? "manual");

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discoveredAccountId,
          name,
          firm,
          platform,
          role,
          balance,
          maxDailyLoss,
          trailingDrawdownLimit,
          multiplier,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not create account.");
        return;
      }

      setMessage(discoveredAccountId ? "Broker account imported." : "Account created.");
      setName("");
      setFirm("");
      router.refresh();
    } finally {
      setPendingId("");
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Account setup
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Create trading accounts</h2>
        </div>
        <Landmark className="text-emerald-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Account name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Topstep 150K leader"
              className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Firm</span>
            <input
              value={firm}
              onChange={(event) => setFirm(event.target.value)}
              placeholder="Topstep, Apex, personal"
              className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-300"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Platform</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as BrokerPlatform)}
              className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-emerald-300"
            >
              {platforms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "leader" | "follower")}
              className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-emerald-300"
            >
              <option value="leader">Leader</option>
              <option value="follower">Follower</option>
            </select>
          </label>
          <NumberField label="Balance" value={balance} onChange={setBalance} />
          <NumberField label="Max daily loss" value={maxDailyLoss} onChange={setMaxDailyLoss} />
          <NumberField
            label="Trailing drawdown"
            value={trailingDrawdownLimit}
            onChange={setTrailingDrawdownLimit}
          />
          <NumberField label="Multiplier" value={multiplier} onChange={setMultiplier} />
        </div>

        <button
          type="button"
          onClick={() => createAccount()}
          disabled={pendingId === "manual"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"
        >
          <Plus size={16} aria-hidden="true" />
          {pendingId === "manual" ? "Creating account" : "Create account"}
        </button>

        {discoveredBrokerAccounts.length ? (
          <div className="grid gap-2 border-t border-white/10 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Import discovered broker accounts
            </p>
            {discoveredBrokerAccounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-[#111820] p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-white">{account.name}</p>
                  <p className="mt-1 text-slate-400">
                    {account.platform} | {account.brokerAccountId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => createAccount(account.id)}
                  disabled={pendingId === account.id}
                  className="btn-secondary"
                >
                  {pendingId === account.id ? "Importing" : "Import"}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-emerald-300"
      />
    </label>
  );
}
