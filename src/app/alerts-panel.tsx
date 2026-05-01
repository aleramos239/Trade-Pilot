"use client";

import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OperatorAlert } from "@/lib/trading/types";

export function AlertsPanel({ alerts }: { alerts: OperatorAlert[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const openAlerts = alerts.filter((alert) => alert.status === "open").slice(0, 6);

  async function acknowledge(alertId: string) {
    setPending(alertId);

    try {
      await fetch(`/api/alerts/${alertId}`, { method: "PATCH" });
      router.refresh();
    } finally {
      setPending("");
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
            Operator alerts
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{openAlerts.length} open</h2>
        </div>
        <Bell className="text-amber-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-2">
        {openAlerts.length ? (
          openAlerts.map((alert) => (
            <div
              key={alert.id}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-white/10 bg-[#111820] p-3 text-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      alert.severity === "critical"
                        ? "bg-rose-300"
                        : alert.severity === "warning"
                          ? "bg-amber-300"
                          : "bg-cyan-300"
                    }`}
                  />
                  <p className="font-medium text-white">{alert.title}</p>
                </div>
                <p className="mt-2 text-slate-400">{alert.message}</p>
                <p className="mt-2 font-mono text-xs text-slate-500">
                  {new Date(alert.createdAt).toLocaleString("en-US")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => acknowledge(alert.id)}
                disabled={pending === alert.id}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                title="Acknowledge alert"
              >
                <Check size={15} aria-hidden="true" />
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            No open operator alerts.
          </p>
        )}
      </div>
    </div>
  );
}
