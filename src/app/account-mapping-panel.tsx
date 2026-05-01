"use client";

import { Link2, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  AccountMapping,
  BrokerConnection,
  DiscoveredBrokerAccount,
  PropAccount,
} from "@/lib/trading/types";

export function AccountMappingPanel({
  accounts,
  brokerConnections,
  discoveredBrokerAccounts,
  accountMappings,
}: {
  accounts: PropAccount[];
  brokerConnections: BrokerConnection[];
  discoveredBrokerAccounts: DiscoveredBrokerAccount[];
  accountMappings: AccountMapping[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const discoverableConnections = brokerConnections.filter(
    (connection) => connection.mode === "live" && connection.credentialVaultId,
  );
  const accountsByPlatform = useMemo(() => {
    return discoveredBrokerAccounts.reduce<Record<string, DiscoveredBrokerAccount[]>>(
      (groups, account) => {
        groups[account.platform] = [...(groups[account.platform] ?? []), account];
        return groups;
      },
      {},
    );
  }, [discoveredBrokerAccounts]);

  async function discover(connectionId: string) {
    setMessage("");
    setError("");
    setPendingId(connectionId);

    try {
      const response = await fetch(`/api/broker-connections/${connectionId}/discover`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Account discovery failed.");
        return;
      }

      setMessage(body.discovery?.message ?? "Account discovery finished.");
      router.refresh();
    } finally {
      setPendingId("");
    }
  }

  async function mapAccount(appAccountId: string, discoveredAccountId: string) {
    if (!discoveredAccountId) {
      return;
    }

    setMessage("");
    setError("");
    setPendingId(appAccountId);

    try {
      const response = await fetch("/api/account-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appAccountId, discoveredAccountId }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not map account.");
        return;
      }

      setMessage("Account mapping saved.");
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
            Account mapping
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Broker account discovery</h2>
        </div>
        <Link2 className="text-emerald-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3">
        {discoverableConnections.length ? (
          discoverableConnections.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-[#111820] p-3 text-sm"
            >
              <div>
                <p className="font-medium text-white">{connection.name}</p>
                <p className="mt-1 text-slate-400">
                  {connection.platform} | {connection.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => discover(connection.id)}
                disabled={pendingId === connection.id}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-300 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"
              >
                <Radar size={14} aria-hidden="true" />
                {pendingId === connection.id ? "discovering" : "discover"}
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            Create a live broker connection with credentials or OAuth to enable account discovery.
          </p>
        )}

        {accounts.length ? (
          <div className="grid gap-3">
          {accounts.map((account) => {
            const candidates = accountsByPlatform[account.platform] ?? [];
            const mapping = accountMappings.find((item) => item.appAccountId === account.id);
            const selected = discoveredBrokerAccounts.find(
              (item) =>
                item.brokerConnectionId === mapping?.brokerConnectionId &&
                item.brokerAccountId === mapping?.brokerAccountId,
            );

            return (
              <label
                key={account.id}
                className="grid gap-2 rounded-md border border-white/10 bg-[#111820] p-3 text-sm"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">{account.name}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {account.platform}
                  </span>
                </span>
                <select
                  value={selected?.id ?? ""}
                  onChange={(event) => mapAccount(account.id, event.target.value)}
                  disabled={!candidates.length || pendingId === account.id}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-emerald-300 disabled:opacity-60"
                >
                  <option value="">
                    {candidates.length ? "Choose broker account" : "No discovered accounts"}
                  </option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.brokerAccountId})
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          </div>
        ) : (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            No app accounts exist yet. Import discovered broker accounts or create accounts in the
            account setup panel first.
          </p>
        )}

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
