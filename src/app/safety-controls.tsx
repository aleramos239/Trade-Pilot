"use client";

import { OctagonAlert, Power, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BrokerConnection, SafetySettings } from "@/lib/trading/types";

export function SafetyControls({
  settings,
  brokerConnections,
}: {
  settings: SafetySettings;
  brokerConnections: BrokerConnection[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const liveConnections = brokerConnections.filter((connection) => connection.mode === "live");

  async function patchSafety(updates: Partial<SafetySettings>) {
    setPending("safety");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/safety", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Could not update safety settings.");
      }

      router.refresh();
    } finally {
      setPending("");
    }
  }

  async function toggleLiveConnection(connection: BrokerConnection) {
    setPending(connection.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/broker-connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveEnabled: !connection.liveEnabled }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Could not update broker connection.");
      }

      router.refresh();
    } finally {
      setPending("");
    }
  }

  async function flattenAll() {
    setPending("flatten");
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/flatten-all", { method: "POST" });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not request flatten-all.");
      } else {
        setNotice(body.message ?? "Flatten-all request processed.");
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
            Safety layer
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Live execution gates</h2>
        </div>
        <ShieldCheck className="text-rose-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <SafetyToggle
            label="Global kill switch"
            active={settings.globalKillSwitch}
            pending={pending === "safety"}
            onClick={() => patchSafety({ globalKillSwitch: !settings.globalKillSwitch })}
            danger
          />
          <SafetyToggle
            label="Workspace live unlock"
            active={settings.liveTradingUnlocked}
            pending={pending === "safety"}
            onClick={() => patchSafety({ liveTradingUnlocked: !settings.liveTradingUnlocked })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberControl
            label="Max qty"
            value={settings.maxOrderQuantity}
            onCommit={(value) => patchSafety({ maxOrderQuantity: value })}
          />
          <NumberControl
            label="Rate seconds"
            value={settings.minSecondsBetweenOrders}
            onCommit={(value) => patchSafety({ minSecondsBetweenOrders: value })}
          />
          <NumberControl
            label="Duplicate seconds"
            value={settings.duplicateWindowSeconds}
            onCommit={(value) => patchSafety({ duplicateWindowSeconds: value })}
          />
        </div>

        <button
          type="button"
          onClick={flattenAll}
          disabled={pending === "flatten"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-rose-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-rose-200 disabled:opacity-60"
        >
          <OctagonAlert size={16} aria-hidden="true" />
          {pending === "flatten" ? "submitting flatten request" : "Flatten all and kill switch"}
        </button>

        {liveConnections.length ? (
          <div className="grid gap-2">
            {liveConnections.map((connection) => (
              <button
                key={connection.id}
                type="button"
                onClick={() => toggleLiveConnection(connection)}
                disabled={pending === connection.id}
                className={`flex h-10 items-center justify-between rounded-md border px-3 text-sm transition disabled:opacity-60 ${
                  connection.liveEnabled
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                    : "border-white/10 bg-[#111820] text-slate-300"
                }`}
              >
                <span>{connection.name}</span>
                <span className="inline-flex items-center gap-2">
                  <Power size={14} aria-hidden="true" />
                  {connection.liveEnabled ? "enabled" : "disabled"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            No live broker connections yet. Live execution stays disabled.
          </p>
        )}

        {settings.flattenAllRequestedAt ? (
          <p className="font-mono text-xs text-slate-500">
            last flatten request {new Date(settings.flattenAllRequestedAt).toLocaleString("en-US")}
          </p>
        ) : null}
        {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}

function SafetyToggle({
  label,
  active,
  pending,
  danger = false,
  onClick,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`h-10 rounded-md px-3 text-sm font-semibold transition disabled:opacity-60 ${
        active
          ? danger
            ? "bg-rose-300 text-slate-950"
            : "bg-emerald-300 text-slate-950"
          : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
      }`}
    >
      {label}: {active ? "on" : "off"}
    </button>
  );
}

function NumberControl({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  return (
    <label className="grid gap-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(Number(draft))}
        type="number"
        min={0}
        className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 font-mono text-slate-100 outline-none transition focus:border-rose-300"
      />
    </label>
  );
}
