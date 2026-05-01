"use client";

import { Activity, ArrowRight, CheckCircle2, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { ExecutionPlan, ExecutionRouteResult } from "@/lib/trading/types";

type RoutedExecutionPlan = ExecutionPlan & {
  routeResult?: ExecutionRouteResult;
};

const defaultAlert = {
  strategy: "NQ momentum reclaim",
  symbol: "NQ",
  side: "buy",
  orderType: "market",
  quantity: 2,
  stopLossTicks: 28,
  takeProfitTicks: 56,
  webhookSecret: "demo-webhook-secret",
};

export function SignalTester() {
  const [payload, setPayload] = useState(JSON.stringify(defaultAlert, null, 2));
  const [plan, setPlan] = useState<RoutedExecutionPlan | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendSignal() {
    setError("");
    setIsSending(true);

    try {
      const parsed = JSON.parse(payload);
      const response = await fetch("/api/webhooks/tradingview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const body = await response.json();

      if (!response.ok && !body.decisions) {
        setError(body.error ?? "Webhook rejected the payload.");
        setPlan(null);
        return;
      }

      setPlan(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send signal.");
      setPlan(null);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-white/10 bg-[#111820] p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Automation webhook
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">TradingView signal tester</h2>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-400/10 text-cyan-200">
            <Activity size={20} aria-hidden="true" />
          </div>
        </div>

        <textarea
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          spellCheck={false}
          className="mt-5 min-h-64 w-full resize-y rounded-md border border-white/10 bg-[#071016] p-4 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-cyan-300"
          aria-label="TradingView webhook JSON payload"
        />

        {error ? (
          <p className="mt-3 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={sendSignal}
          disabled={isSending}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={16} aria-hidden="true" />
          {isSending ? "Routing signal" : "Send test signal"}
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-[#111820] p-5 shadow-2xl shadow-black/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Execution preview
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">Risk checked account routing</h2>
          </div>
          <ArrowRight className="text-emerald-300" size={22} aria-hidden="true" />
        </div>

        <div className="mt-5 space-y-3">
          {plan ? (
            <>
              {plan.routeResult ? (
                <div className="grid gap-3 rounded-md border border-white/10 bg-[#071016] p-4 text-sm sm:grid-cols-5">
                  <Metric label="Simulated" value={String(plan.routeResult.summary.simulated)} />
                  <Metric
                    label="Live"
                    value={String(plan.routeResult.summary.liveSubmitted)}
                  />
                  <Metric label="Blocked" value={String(plan.routeResult.summary.blocked)} />
                  <Metric
                    label="Safety"
                    value={String(plan.routeResult.summary.safetyBlocked)}
                  />
                  <Metric label="Rejected" value={String(plan.routeResult.summary.rejected)} />
                </div>
              ) : null}
              {plan.decisions.map((decision) => (
                <div
                  key={decision.accountId}
                  className="rounded-md border border-white/10 bg-[#071016] p-4"
                >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{decision.accountName}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {decision.firm} | {decision.platform} | {decision.latencyMs}ms route
                    </p>
                  </div>
                  <span
                    className={
                      decision.action === "queued"
                        ? "inline-flex items-center gap-1 rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-300"
                        : "inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-300"
                    }
                  >
                    {decision.action === "queued" ? (
                      <CheckCircle2 size={14} aria-hidden="true" />
                    ) : (
                      <ShieldAlert size={14} aria-hidden="true" />
                    )}
                    {decision.action}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <Metric label="Order" value={`${decision.side} ${decision.quantity} ${decision.symbol}`} />
                  <Metric
                    label="Daily buffer"
                    value={`$${Math.round(decision.riskAfterOrder.dailyLossBuffer).toLocaleString()}`}
                  />
                  <Metric
                    label="DD remaining"
                    value={`$${Math.round(decision.riskAfterOrder.drawdownRemaining).toLocaleString()}`}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-400">{decision.reason}</p>
                </div>
              ))}
            </>
          ) : (
            <div className="grid min-h-64 place-items-center rounded-md border border-dashed border-white/15 bg-[#071016] p-6 text-center text-sm text-slate-400">
              Send a sample signal to see how follower accounts are sized, blocked, or queued.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-slate-100">{value}</p>
    </div>
  );
}
