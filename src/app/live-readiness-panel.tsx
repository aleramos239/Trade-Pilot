import { Activity, Cable, LockKeyhole, Route } from "lucide-react";
import type { ReactNode } from "react";
import type {
  AccountMapping,
  BrokerConnection,
  PropAccount,
  SafetySettings,
} from "@/lib/trading/types";

export function LiveReadinessPanel({
  accounts,
  accountMappings,
  brokerConnections,
  safetySettings,
}: {
  accounts: PropAccount[];
  accountMappings: AccountMapping[];
  brokerConnections: BrokerConnection[];
  safetySettings: SafetySettings;
}) {
  const liveConnections = brokerConnections.filter((connection) => connection.mode === "live");
  const simulatedConnections = brokerConnections.filter((connection) => connection.mode === "simulation");
  const mappedLiveAccounts = accountMappings.filter((mapping) =>
    liveConnections.some((connection) => connection.id === mapping.brokerConnectionId),
  );
  const liveReady = liveConnections.some((connection) => {
    const mappedAccounts = accountMappings.filter(
      (mapping) => mapping.brokerConnectionId === connection.id,
    ).length;

    return (
      connection.status === "connected" &&
      connection.liveEnabled &&
      safetySettings.liveTradingUnlocked &&
      !safetySettings.globalKillSwitch &&
      mappedAccounts > 0
    );
  });

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Route preview
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {liveReady ? "Live-capable path" : "Dry-run protected path"}
          </h2>
        </div>
        {liveReady ? (
          <Activity className="text-emerald-300" size={22} aria-hidden="true" />
        ) : (
          <LockKeyhole className="text-amber-300" size={22} aria-hidden="true" />
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PreviewTile
          icon={<Route size={16} aria-hidden="true" />}
          label="Sim routes"
          value={String(simulatedConnections.length)}
          tone="cyan"
        />
        <PreviewTile
          icon={<Cable size={16} aria-hidden="true" />}
          label="Live routes"
          value={`${mappedLiveAccounts.length}/${accounts.length}`}
          tone={mappedLiveAccounts.length ? "emerald" : "amber"}
        />
        <PreviewTile
          icon={<LockKeyhole size={16} aria-hidden="true" />}
          label="Live gate"
          value={liveReady ? "armed" : "locked"}
          tone={liveReady ? "emerald" : "amber"}
        />
      </div>

      {liveConnections.length ? (
        <div className="mt-4 grid gap-2">
          {liveConnections.map((connection) => {
            const mappedAccounts = accountMappings.filter(
              (mapping) => mapping.brokerConnectionId === connection.id,
            ).length;
            const blockedBy = [
              connection.status !== "connected" ? "connection" : null,
              !connection.liveEnabled ? "broker toggle" : null,
              !safetySettings.liveTradingUnlocked ? "workspace unlock" : null,
              safetySettings.globalKillSwitch ? "kill switch" : null,
              mappedAccounts === 0 ? "account mapping" : null,
            ].filter(Boolean);

            return (
              <div
                key={connection.id}
                className="rounded-md border border-white/10 bg-[#111820] p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{connection.name}</p>
                  <p className="font-mono text-xs text-slate-400">{mappedAccounts} mapped</p>
                </div>
                <p className="mt-2 text-slate-400">
                  {blockedBy.length
                    ? `blocked by ${blockedBy.join(", ")}`
                    : "ready for safety-gated live submission"}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PreviewTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "amber";
}) {
  const colors = {
    cyan: "bg-cyan-400/10 text-cyan-300",
    emerald: "bg-emerald-400/10 text-emerald-300",
    amber: "bg-amber-400/10 text-amber-300",
  };

  return (
    <div className="rounded-md border border-white/10 bg-[#111820] p-3">
      <div className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${colors[tone]}`}>
        {icon}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-white">{value}</p>
    </div>
  );
}
