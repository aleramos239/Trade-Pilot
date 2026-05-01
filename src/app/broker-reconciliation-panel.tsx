"use client";

import { RefreshCw, ScrollText, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  BrokerConnection,
  BrokerFillSnapshot,
  BrokerOrderSnapshot,
  BrokerPositionSnapshot,
} from "@/lib/trading/types";

export function BrokerReconciliationPanel({
  brokerConnections,
  positions,
  orders,
  fills,
}: {
  brokerConnections: BrokerConnection[];
  positions: BrokerPositionSnapshot[];
  orders: BrokerOrderSnapshot[];
  fills: BrokerFillSnapshot[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const liveConnections = brokerConnections.filter((connection) => connection.mode === "live");
  const activePositions = positions.filter((position) => position.active && position.quantity > 0);
  const workingOrders = orders.filter((order) =>
    ["PendingCancel", "PendingNew", "PendingReplace", "Suspended", "Working"].includes(order.status),
  );
  const lastSync = useMemo(() => {
    const timestamps = [...positions, ...orders, ...fills].map((item) => item.syncedAt).sort();
    return timestamps.at(-1) ?? null;
  }, [positions, orders, fills]);

  async function reconcile(connectionId: string) {
    setPending(connectionId);
    setError("");

    try {
      const response = await fetch(`/api/broker-connections/${connectionId}/reconcile`, {
        method: "POST",
      });
      const body = await response.json();

      if (!response.ok || body.reconciliation?.ok === false) {
        setError(body.error ?? body.reconciliation?.message ?? "Could not reconcile broker.");
      }

      router.refresh();
    } finally {
      setPending("");
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Broker sync
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Positions and orders</h2>
        </div>
        <WalletCards className="text-emerald-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SyncMetric label="Open positions" value={String(activePositions.length)} />
        <SyncMetric label="Working orders" value={String(workingOrders.length)} />
        <SyncMetric label="Recent fills" value={String(fills.length)} />
      </div>

      <div className="mt-4 grid gap-2">
        {liveConnections.length ? (
          liveConnections.map((connection) => (
            <button
              key={connection.id}
              type="button"
              onClick={() => reconcile(connection.id)}
              disabled={pending === connection.id}
              className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/10 bg-[#111820] px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-60"
            >
              <span>
                <span className="block font-medium text-white">{connection.name}</span>
                <span className="font-mono text-xs text-slate-500">{connection.status}</span>
              </span>
              <span className="inline-flex items-center gap-2 text-cyan-200">
                <RefreshCw size={15} aria-hidden="true" />
                {pending === connection.id ? "syncing" : "sync"}
              </span>
            </button>
          ))
        ) : (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            Add a live broker connection to sync broker state.
          </p>
        )}
      </div>

      {lastSync ? (
        <p className="mt-3 font-mono text-xs text-slate-500">
          last sync {new Date(lastSync).toLocaleString("en-US")}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <div className="mt-5 grid gap-3">
        {activePositions.slice(0, 5).map((position) => (
          <SnapshotRow
            key={position.id}
            label={`${position.side} ${position.quantity} ${position.symbol}`}
            detail={`account ${position.brokerAccountId}`}
            status={position.averagePrice === null ? "active" : `avg ${position.averagePrice}`}
          />
        ))}
        {workingOrders.slice(0, 5).map((order) => (
          <SnapshotRow
            key={order.id}
            label={`${order.side} ${order.symbol}`}
            detail={`order ${order.brokerOrderId}`}
            status={order.status}
          />
        ))}
        {!activePositions.length && !workingOrders.length ? (
          <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-white/15 bg-[#111820] p-4 text-center text-sm text-slate-400">
            <ScrollText size={18} aria-hidden="true" className="mb-2 text-slate-500" />
            No active broker exposure in the latest snapshot.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SyncMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#111820] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-white">{value}</p>
    </div>
  );
}

function SnapshotRow({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-white/10 bg-[#111820] p-3 text-sm">
      <div>
        <p className="font-medium text-white">{label}</p>
        <p className="mt-1 font-mono text-xs text-slate-500">{detail}</p>
      </div>
      <p className="self-center font-mono text-xs text-slate-300">{status}</p>
    </div>
  );
}
