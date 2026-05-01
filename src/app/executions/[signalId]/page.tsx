import {
  ArrowLeft,
  BadgeCheck,
  CircleSlash,
  FileJson,
  Gauge,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { OperatorLogin } from "@/app/operator-login";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspaceForUser } from "@/lib/data/store";
import type { ExecutionAudit, ExecutionRecord } from "@/lib/trading/types";

export const dynamic = "force-dynamic";

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ signalId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return <OperatorLogin />;
  }

  const { signalId } = await params;
  const workspace = await getWorkspaceForUser(user.id);
  const records =
    workspace?.executionRecords
      .filter((record) => record.signalId === signalId)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)) ?? [];
  const audit = workspace?.executionAudits.find((item) => item.signalId === signalId) ?? null;

  if (!workspace || (!records.length && !audit)) {
    return (
      <main className="min-h-screen bg-[#081016] px-4 py-6 text-slate-100">
        <div className="mx-auto max-w-5xl rounded-lg border border-white/10 bg-[#0d151d] p-6">
          <BackLink />
          <h1 className="mt-5 text-2xl font-semibold text-white">Execution not found</h1>
          <p className="mt-2 text-sm text-slate-400">
            No audit records are available for signal {signalId}.
          </p>
        </div>
      </main>
    );
  }

  const summary = audit?.routeSummary ?? summarizeRecords(records);
  const firstRecord = records[0];
  const createdAt = audit?.createdAt ?? firstRecord?.requestedAt ?? new Date().toISOString();
  const brokerConnections = new Map(
    workspace.brokerConnections.map((connection) => [connection.id, connection.name]),
  );

  return (
    <main className="min-h-screen bg-[#081016] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="border-b border-white/10 pb-5">
          <BackLink />
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Execution audit
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-white">{signalId}</h1>
              <p className="mt-2 font-mono text-xs text-slate-500">
                {new Date(createdAt).toLocaleString("en-US")}
              </p>
            </div>
            <StatusBadge records={records} />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Simulated" value={String(summary.simulated)} tone="emerald" />
          <Metric label="Live" value={String(summary.liveSubmitted)} tone="cyan" />
          <Metric label="Blocked" value={String(summary.blocked)} tone="amber" />
          <Metric label="Rejected" value={String(summary.rejected)} tone="rose" />
          <Metric label="Safety" value={String(summary.safetyBlocked)} tone="rose" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                  Account routing
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">Broker outcomes</h2>
              </div>
              <Gauge size={22} className="text-amber-300" aria-hidden="true" />
            </div>

            <div className="mt-5 overflow-hidden rounded-md border border-white/10">
              {records.map((record) => (
                <ExecutionRow
                  key={record.id}
                  record={record}
                  brokerName={
                    record.brokerConnectionId
                      ? brokerConnections.get(record.brokerConnectionId) ?? record.brokerConnectionId
                      : "unrouted"
                  }
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <AuditPanel audit={audit} />
            <PlanPanel audit={audit} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <JsonPanel title="Webhook Payload" data={audit?.payload ?? { note: "No payload captured for this signal." }} />
          <JsonPanel
            title="Broker Raw Responses"
            data={
              records.length
                ? records.map((record) => ({
                    accountName: record.accountName,
                    brokerOrderId: record.brokerOrderId,
                    status: record.status,
                    raw: record.brokerRaw,
                  }))
                : { note: "No broker responses captured for this signal." }
            }
          />
        </section>
      </div>
    </main>
  );
}

function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200">
      <ArrowLeft size={16} aria-hidden="true" />
      Dashboard
    </Link>
  );
}

function summarizeRecords(records: ExecutionRecord[]): ExecutionAudit["routeSummary"] {
  return {
    simulated: records.filter((record) => record.status === "simulated").length,
    liveSubmitted: records.filter((record) => record.status === "live_submitted").length,
    blocked: records.filter((record) => record.status === "blocked").length,
    rejected: records.filter((record) => record.status === "rejected").length,
    safetyBlocked: records.filter((record) => record.status === "safety_blocked").length,
  };
}

function StatusBadge({ records }: { records: ExecutionRecord[] }) {
  const hasLive = records.some((record) => record.status === "live_submitted");
  const hasRejected = records.some(
    (record) => record.status === "rejected" || record.status === "safety_blocked",
  );
  const hasBlocked = records.some((record) => record.status === "blocked");
  const label = hasLive ? "live submitted" : hasRejected ? "needs review" : hasBlocked ? "blocked" : "simulated";
  const color = hasLive
    ? "bg-cyan-300 text-slate-950"
    : hasRejected
      ? "bg-rose-300 text-slate-950"
      : hasBlocked
        ? "bg-amber-300 text-slate-950"
        : "bg-emerald-300 text-slate-950";

  return (
    <span className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold ${color}`}>
      {label}
    </span>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber" | "rose";
}) {
  const colors = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-2xl ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function ExecutionRow({
  record,
  brokerName,
}: {
  record: ExecutionRecord;
  brokerName: string;
}) {
  return (
    <div className="grid gap-3 border-b border-white/10 bg-[#111820] p-4 text-sm last:border-b-0 lg:grid-cols-[1fr_0.85fr_0.75fr_0.75fr]">
      <div>
        <p className="font-medium text-white">{record.accountName}</p>
        <p className="mt-1 font-mono text-xs text-slate-500">{record.brokerAccountId ?? "no broker account"}</p>
      </div>
      <div>
        <p className="text-slate-400">{brokerName}</p>
        <p className="mt-1 font-mono text-xs text-slate-500">{record.mode}</p>
      </div>
      <div>
        <p className="text-slate-300">
          {record.side} {record.quantity} {record.symbol}
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">{record.latencyMs}ms</p>
      </div>
      <div>
        <StatusText status={record.status} />
        <p className="mt-2 text-xs leading-5 text-slate-400">{record.reason}</p>
      </div>
    </div>
  );
}

function StatusText({ status }: { status: ExecutionRecord["status"] }) {
  const colors = {
    simulated: "text-emerald-300",
    live_submitted: "text-cyan-300",
    blocked: "text-amber-300",
    rejected: "text-rose-300",
    safety_blocked: "text-rose-300",
  };

  return <p className={`font-mono text-xs ${colors[status]}`}>{status}</p>;
}

function AuditPanel({ audit }: { audit: ExecutionAudit | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5">
      <div className="flex items-center gap-3">
        <BadgeCheck size={19} className="text-emerald-300" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">Audit metadata</h2>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <Readout label="Source" value={audit?.source ?? "legacy record"} />
        <Readout label="Idempotency" value={audit?.idempotencyKey ?? "none"} />
        <Readout label="Duplicate" value={audit?.duplicate ? "yes" : "no"} />
      </div>
    </div>
  );
}

function PlanPanel({ audit }: { audit: ExecutionAudit | null }) {
  const warnings = audit?.executionPlan?.warnings ?? [];

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5">
      <div className="flex items-center gap-3">
        {warnings.length ? (
          <ShieldAlert size={19} className="text-amber-300" aria-hidden="true" />
        ) : (
          <CircleSlash size={19} className="text-slate-500" aria-hidden="true" />
        )}
        <h2 className="text-lg font-semibold text-white">Plan warnings</h2>
      </div>
      <div className="mt-4 grid gap-2">
        {warnings.length ? (
          warnings.map((warning) => (
            <p key={warning} className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
              {warning}
            </p>
          ))
        ) : (
          <p className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm text-slate-400">
            No execution plan warnings captured.
          </p>
        )}
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-[#111820] p-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-xs text-slate-100">{value}</span>
    </div>
  );
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5">
      <div className="flex items-center gap-3">
        <FileJson size={19} className="text-cyan-300" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <pre className="mt-4 max-h-[28rem] overflow-auto rounded-md border border-white/10 bg-[#071016] p-4 text-xs leading-5 text-slate-300">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
