"use client";

import { Bot, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PropAccount } from "@/lib/trading/types";

export function AutomationSetupPanel({ accounts }: { accounts: PropAccount[] }) {
  const router = useRouter();
  const [name, setName] = useState("Main copy automation");
  const [leaderAccountId, setLeaderAccountId] = useState("");
  const [followerAccountIds, setFollowerAccountIds] = useState<string[]>([]);
  const [symbolMap, setSymbolMap] = useState("NQ=NQ\nMNQ=MNQ\nES=ES\nMES=MES");
  const [maxContractsPerFollower, setMaxContractsPerFollower] = useState("1");
  const [copyStopsAndTargets, setCopyStopsAndTargets] = useState(true);
  const [autoFlattenOnRuleBreach, setAutoFlattenOnRuleBreach] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const followers = useMemo(
    () => accounts.filter((account) => account.id !== leaderAccountId),
    [accounts, leaderAccountId],
  );

  function toggleFollower(accountId: string) {
    setFollowerAccountIds((selected) =>
      selected.includes(accountId)
        ? selected.filter((item) => item !== accountId)
        : [...selected, accountId],
    );
  }

  async function createAutomation() {
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/copier-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          leaderAccountId,
          followerAccountIds,
          symbolMap,
          maxContractsPerFollower,
          copyStopsAndTargets,
          autoFlattenOnRuleBreach,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not create automation.");
        return;
      }

      setMessage("Automation group created. It starts paused so you can review it first.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Automation setup
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Create execution group</h2>
        </div>
        <Bot className="text-cyan-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3">
        {accounts.length < 2 ? (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            Add at least one leader and one follower account before creating an automation group.
          </p>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="text-slate-400">Group name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-slate-400">Leader account</span>
          <select
            value={leaderAccountId}
            onChange={(event) => {
              setLeaderAccountId(event.target.value);
              setFollowerAccountIds((selected) =>
                selected.filter((accountId) => accountId !== event.target.value),
              );
            }}
            className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
          >
            <option value="">Choose leader</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.platform})
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 rounded-md border border-white/10 bg-[#111820] p-3">
          <p className="text-sm font-medium text-white">Follower accounts</p>
          {followers.map((account) => (
            <label key={account.id} className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={followerAccountIds.includes(account.id)}
                onChange={() => toggleFollower(account.id)}
                className="h-4 w-4 accent-cyan-300"
              />
              {account.name} ({account.platform})
            </label>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[0.65fr_0.35fr]">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Symbol map</span>
            <textarea
              value={symbolMap}
              onChange={(event) => setSymbolMap(event.target.value)}
              className="min-h-28 rounded-md border border-white/10 bg-[#071016] p-3 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-300"
            />
          </label>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-400">Max contracts</span>
              <input
                value={maxContractsPerFollower}
                onChange={(event) => setMaxContractsPerFollower(event.target.value)}
                inputMode="numeric"
                className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={copyStopsAndTargets}
                onChange={(event) => setCopyStopsAndTargets(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              Copy stops/targets
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={autoFlattenOnRuleBreach}
                onChange={(event) => setAutoFlattenOnRuleBreach(event.target.checked)}
                className="h-4 w-4 accent-cyan-300"
              />
              Auto flatten on breach
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={createAutomation}
          disabled={isSaving || accounts.length < 2}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
        >
          <Plus size={16} aria-hidden="true" />
          {isSaving ? "Creating automation" : "Create automation group"}
        </button>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
