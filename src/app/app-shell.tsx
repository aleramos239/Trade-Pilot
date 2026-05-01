"use client";

import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Box,
  Cable,
  CalendarDays,
  CheckCircle2,
  Eye,
  Gauge,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  PlugZap,
  Plus,
  Repeat2,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ComponentType, type ReactNode, useState } from "react";
import { AccountMappingPanel } from "./account-mapping-panel";
import { AccountSetupPanel } from "./account-setup-panel";
import { AlertsPanel } from "./alerts-panel";
import { AutomationSetupPanel } from "./automation-setup-panel";
import { BrokerConnectionForm } from "./broker-connection-form";
import { BrokerReconciliationPanel } from "./broker-reconciliation-panel";
import { LiveReadinessPanel } from "./live-readiness-panel";
import { SafetyControls } from "./safety-controls";
import { SignalTester } from "./signal-tester";
import { AccountControls, CopierRuleToggle, SignOutButton } from "./workspace-actions";
import type {
  BrokerConnection,
  CopierRule,
  ExecutionRecord,
  PropAccount,
  TradingWorkspace,
} from "@/lib/trading/types";

type SectionId =
  | "dashboard"
  | "connections"
  | "copy"
  | "automation"
  | "risk"
  | "reports"
  | "prop"
  | "settings"
  | "support";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const navItems: { id: SectionId; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "connections", label: "Connections", icon: Cable },
  { id: "copy", label: "Copy Groups", icon: Repeat2 },
  { id: "automation", label: "Trade Automation", icon: Bot },
  { id: "risk", label: "Risk Management", icon: Shield },
  { id: "reports", label: "Report | Journal", icon: BarChart3 },
  { id: "prop", label: "Prop Firm Tracker", icon: Landmark },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "support", label: "Support", icon: LifeBuoy },
];

export function AppShell({
  workspace,
  tradovateOAuthConfigured,
}: {
  workspace: TradingWorkspace;
  tradovateOAuthConfigured: boolean;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeRule = workspace.copierRules.find((rule) => rule.enabled) ?? workspace.copierRules[0];
  const leaderAccountId = activeRule?.leaderAccountId ?? workspace.accounts[0]?.id;
  const openAlerts = workspace.alerts.filter((alert) => alert.status === "open");
  const activePositions = workspace.brokerPositions.filter(
    (position) => position.active && position.quantity > 0,
  );
  const liveConnections = workspace.brokerConnections.filter((connection) => connection.mode === "live");
  const totalBalance = workspace.accounts.reduce((sum, account) => sum + account.balance, 0);
  const liveReady = liveConnections.some(
    (connection) =>
      connection.status === "connected" &&
      connection.liveEnabled &&
      workspace.safetySettings.liveTradingUnlocked &&
      !workspace.safetySettings.globalKillSwitch,
  );

  return (
    <main className="min-h-screen bg-[#070c0a] text-slate-100">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-white/10 bg-[#191c1a] transition-transform lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-24 items-center px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-indigo-400 text-white">
                  <Box size={20} aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-semibold text-white">TradePilot</p>
                    <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      v1
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">prop execution console</p>
                </div>
              </div>
            </div>

            <nav className="grid gap-1 px-3">
              {navItems.slice(0, 7).map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeSection === item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setSidebarOpen(false);
                  }}
                />
              ))}
            </nav>

            <div className="mt-auto grid gap-1 px-3 pb-6">
              {navItems.slice(7).map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={activeSection === item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setSidebarOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#191c1a]/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-300 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu size={19} aria-hidden="true" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {workspace.user.workspaceId}
                  </p>
                  <h1 className="text-lg font-semibold text-white">
                    {navItems.find((item) => item.id === activeSection)?.label}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusChip label={liveReady ? "Live ready" : "Dry-run protected"} active={liveReady} />
                <button
                  type="button"
                  onClick={() => setActiveSection("risk")}
                  className="relative grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-300"
                  aria-label="Open alerts"
                >
                  <Bell size={17} aria-hidden="true" />
                  {openAlerts.length ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-bold text-slate-950">
                      {openAlerts.length}
                    </span>
                  ) : null}
                </button>
                <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-amber-300 bg-indigo-500 text-sm font-bold text-white">
                  {workspace.user.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <SignOutButton />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-x-hidden p-4 lg:p-6">
            {activeSection === "dashboard" ? (
              <DashboardView
                workspace={workspace}
                activeRule={activeRule}
                totalBalance={totalBalance}
                openAlerts={openAlerts.length}
                activePositions={activePositions.length}
                setSection={setActiveSection}
              />
            ) : null}
            {activeSection === "connections" ? (
              <ConnectionsView
                workspace={workspace}
                tradovateOAuthConfigured={tradovateOAuthConfigured}
              />
            ) : null}
            {activeSection === "copy" ? (
              <CopyTradeView workspace={workspace} activeRule={activeRule} leaderAccountId={leaderAccountId} />
            ) : null}
            {activeSection === "automation" ? <AutomationView workspace={workspace} /> : null}
            {activeSection === "risk" ? <RiskView workspace={workspace} /> : null}
            {activeSection === "reports" ? <ReportsView workspace={workspace} /> : null}
            {activeSection === "prop" ? <PropFirmView workspace={workspace} /> : null}
            {activeSection === "settings" ? <SettingsView workspace={workspace} /> : null}
            {activeSection === "support" ? <SupportView /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 items-center gap-3 rounded-md px-4 text-sm font-semibold transition ${
        active ? "bg-white/[0.06] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      }`}
    >
      <Icon size={17} />
      {item.label}
    </button>
  );
}

function DashboardView({
  workspace,
  activeRule,
  totalBalance,
  openAlerts,
  activePositions,
  setSection,
}: {
  workspace: TradingWorkspace;
  activeRule?: CopierRule;
  totalBalance: number;
  openAlerts: number;
  activePositions: number;
  setSection: (section: SectionId) => void;
}) {
  const onlineAccounts = workspace.accounts.filter((account) => account.status === "online").length;
  const recent = workspace.executionRecords.slice(0, 8);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Accounts" value={String(workspace.accounts.length)} detail={`${onlineAccounts} online`} tone="cyan" />
        <MetricTile label="Managed balance" value={money.format(totalBalance)} detail="leader + followers" tone="emerald" />
        <MetricTile label="Open exposure" value={String(activePositions)} detail="from broker sync" tone={activePositions ? "rose" : "slate"} />
        <MetricTile label="Alerts" value={String(openAlerts)} detail="operator queue" tone={openAlerts ? "amber" : "slate"} />
        <MetricTile label="Copy rule" value={activeRule?.enabled ? "Active" : "Paused"} detail={activeRule?.name ?? "not configured"} tone="indigo" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          eyebrow="Command center"
          title="Today’s operating state"
          icon={<Activity size={20} aria-hidden="true" />}
          actions={
            <>
              <button type="button" onClick={() => setSection("connections")} className="btn-secondary">
                <Cable size={15} aria-hidden="true" />
                Connections
              </button>
              <button type="button" onClick={() => setSection("automation")} className="btn-primary">
                <Bot size={15} aria-hidden="true" />
                Automation
              </button>
            </>
          }
        >
          {workspace.accounts.length ? (
            <div className="grid gap-3">
              {workspace.accounts.slice(0, 6).map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No trading accounts yet"
              detail="Connect a broker, discover accounts, then import or create leader and follower accounts."
              action={
                <button type="button" onClick={() => setSection("connections")} className="btn-primary">
                  <Cable size={15} aria-hidden="true" />
                  Start connections
                </button>
              }
            />
          )}
        </Panel>

        <div className="grid gap-4">
          <AlertsPanel alerts={workspace.alerts} />
          <BrokerStatusPanel connections={workspace.brokerConnections} />
        </div>
      </div>

      <Panel eyebrow="Audit" title="Recent executions" icon={<Gauge size={20} aria-hidden="true" />}>
        <ExecutionTable records={recent} empty="No executions routed yet." />
      </Panel>
    </div>
  );
}

function ConnectionsView({
  workspace,
  tradovateOAuthConfigured,
}: {
  workspace: TradingWorkspace;
  tradovateOAuthConfigured: boolean;
}) {
  return (
    <div className="grid gap-4">
      <BestPractices />
      <Panel
        eyebrow="Connections"
        title="Broker connections"
        icon={<Cable size={20} aria-hidden="true" />}
        actions={
          <button type="button" className="btn-primary" onClick={() => document.getElementById("broker-setup")?.scrollIntoView({ behavior: "smooth" })}>
            <Plus size={15} aria-hidden="true" />
            Add connection
          </button>
        }
      >
        <BrokerConnectionsTable connections={workspace.brokerConnections} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2" id="broker-setup">
        <BrokerConnectionForm tradovateOAuthConfigured={tradovateOAuthConfigured} />
        <AccountSetupPanel discoveredBrokerAccounts={workspace.discoveredBrokerAccounts} />
        <AccountMappingPanel
          accounts={workspace.accounts}
          brokerConnections={workspace.brokerConnections}
          discoveredBrokerAccounts={workspace.discoveredBrokerAccounts}
          accountMappings={workspace.accountMappings}
        />
      </div>
    </div>
  );
}

function CopyTradeView({
  workspace,
  activeRule,
  leaderAccountId,
}: {
  workspace: TradingWorkspace;
  activeRule?: CopierRule;
  leaderAccountId?: string;
}) {
  const followers = activeRule
    ? workspace.accounts.filter((account) => activeRule.followerAccountIds.includes(account.id))
    : [];
  const leader = workspace.accounts.find((account) => account.id === leaderAccountId);

  return (
    <div className="grid gap-4">
      <CopyLimitsBar workspace={workspace} />
      <Panel
        eyebrow="Copy trading groups"
        title={activeRule?.name ?? "No active copy group"}
        icon={<Repeat2 size={20} aria-hidden="true" />}
        actions={activeRule ? <CopierRuleToggle ruleId={activeRule.id} enabled={activeRule.enabled} /> : null}
      >
        {activeRule && leader ? (
          <>
            <LeaderRow account={leader} rule={activeRule} />
            <div className="mt-4 overflow-hidden rounded-md border border-white/10">
              <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <span>Account</span>
                <span>Broker</span>
                <span>Daily P&L</span>
                <span>Drawdown</span>
                <span>Action</span>
              </div>
              {followers.map((account) => (
                <div
                  key={account.id}
                  className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_0.7fr] items-center gap-3 border-b border-white/10 bg-[#1d211f] px-3 py-3 text-sm last:border-b-0"
                >
                  <AccountName account={account} />
                  <span className="text-slate-300">{account.platform}</span>
                  <span className={account.dailyPnl >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {money.format(account.dailyPnl)}
                  </span>
                  <span className="font-mono text-slate-300">{account.drawdownUsed}%</span>
                  <AccountControls
                    accountId={account.id}
                    copyEnabled={account.copyEnabled}
                    status={account.status}
                    isLeader={false}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No copy group configured"
            detail="Create leader and follower accounts, then build a copy automation group."
          />
        )}
      </Panel>
    </div>
  );
}

function AutomationView({ workspace }: { workspace: TradingWorkspace }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <AutomationSetupPanel accounts={workspace.accounts} />
        <Panel eyebrow="Webhook" title="Automated execution endpoint" icon={<Bot size={20} aria-hidden="true" />}>
          <div className="grid gap-3 text-sm text-slate-300">
            <ReadoutRow label="POST URL" value="/api/webhooks/tradingview" />
            <ReadoutRow label="Secret header" value="x-trade-copilot-secret" />
            <ReadoutRow label="Idempotency header" value="x-trade-copilot-idempotency-key" />
            <p className="rounded-md border border-amber-300/20 bg-amber-300/5 p-3 text-amber-100">
              Signals route to live brokers only after broker connection, account mapping, broker
              live toggle, workspace live unlock, and kill-switch checks pass.
            </p>
          </div>
        </Panel>
      </div>

      <SignalTester />

      <Panel eyebrow="Executions" title="Latest automation results" icon={<Zap size={20} aria-hidden="true" />}>
        <ExecutionTable records={workspace.executionRecords.slice(0, 12)} empty="No automated executions yet." />
      </Panel>
    </div>
  );
}

function RiskView({ workspace }: { workspace: TradingWorkspace }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-4">
        <SafetyControls settings={workspace.safetySettings} brokerConnections={workspace.brokerConnections} />
        <LiveReadinessPanel
          accounts={workspace.accounts}
          brokerConnections={workspace.brokerConnections}
          accountMappings={workspace.accountMappings}
          safetySettings={workspace.safetySettings}
        />
      </div>
      <div className="grid gap-4">
        <BrokerReconciliationPanel
          brokerConnections={workspace.brokerConnections}
          positions={workspace.brokerPositions}
          orders={workspace.brokerOrders}
          fills={workspace.brokerFills}
        />
        <AlertsPanel alerts={workspace.alerts} />
      </div>
    </div>
  );
}

function ReportsView({ workspace }: { workspace: TradingWorkspace }) {
  const liveSubmitted = workspace.executionRecords.filter((record) => record.status === "live_submitted").length;
  const simulated = workspace.executionRecords.filter((record) => record.status === "simulated").length;
  const rejected = workspace.executionRecords.filter((record) => record.status === "rejected").length;
  const blocked = workspace.executionRecords.filter(
    (record) => record.status === "blocked" || record.status === "safety_blocked",
  ).length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Live submitted" value={String(liveSubmitted)} detail="broker accepted" tone="cyan" />
        <MetricTile label="Simulated" value={String(simulated)} detail="paper routes" tone="emerald" />
        <MetricTile label="Blocked" value={String(blocked)} detail="risk or account state" tone="amber" />
        <MetricTile label="Rejected" value={String(rejected)} detail="broker or mapping issue" tone="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel eyebrow="Journal" title="May 2026" icon={<CalendarDays size={20} aria-hidden="true" />}>
          <CalendarGrid records={workspace.executionRecords} />
        </Panel>
        <Panel eyebrow="Execution detail" title="Audit trail" icon={<BarChart3 size={20} aria-hidden="true" />}>
          <ExecutionTable records={workspace.executionRecords.slice(0, 12)} empty="No audit records yet." />
        </Panel>
      </div>
    </div>
  );
}

function PropFirmView({ workspace }: { workspace: TradingWorkspace }) {
  const accounts = workspace.accounts;
  const active = accounts.filter((account) => account.status === "online").length;
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalPnl = accounts.reduce((sum, account) => sum + account.dailyPnl, 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Accounts" value={String(accounts.length)} detail={`${active} active`} tone="cyan" />
        <MetricTile label="Total balance" value={money.format(totalBalance)} detail="tracked capital" tone="emerald" />
        <MetricTile label="Daily P&L" value={money.format(totalPnl)} detail="all accounts" tone={totalPnl >= 0 ? "emerald" : "rose"} />
        <MetricTile label="Pass rate" value="0.0%" detail="funded tracker" tone="slate" />
        <MetricTile label="Events" value="0" detail="this month" tone="indigo" />
      </div>
      <Panel eyebrow="Prop firm tracker" title="Accounts" icon={<Landmark size={20} aria-hidden="true" />}>
        {accounts.length ? (
          <div className="grid gap-3">
            {accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No prop accounts tracked"
            detail="Create accounts manually or import discovered broker accounts after connecting a broker."
          />
        )}
      </Panel>
      <AccountSetupPanel discoveredBrokerAccounts={workspace.discoveredBrokerAccounts} />
    </div>
  );
}

function SettingsView({ workspace }: { workspace: TradingWorkspace }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel eyebrow="Workspace" title="System settings" icon={<SlidersHorizontal size={20} aria-hidden="true" />}>
        <div className="grid gap-3">
          <ReadoutRow label="Workspace" value={workspace.user.workspaceId} />
          <ReadoutRow label="Operator" value={`${workspace.user.name} (${workspace.user.role})`} />
          <ReadoutRow label="Webhook secret" value="configured" />
          <ReadoutRow label="Storage mode" value="local or Postgres by environment" />
        </div>
      </Panel>
      <Panel eyebrow="Operations" title="Production checklist" icon={<CheckCircle2 size={20} aria-hidden="true" />}>
        <div className="grid gap-2 text-sm text-slate-300">
          <ChecklistItem label="Set DATABASE_URL and run db:migrate" />
          <ChecklistItem label="Set CREDENTIAL_ENCRYPTION_KEY" />
          <ChecklistItem label="Set OPERATOR_PASSWORD_HASH" />
          <ChecklistItem label="Set CRON_SECRET for scheduled reconciliation" />
          <ChecklistItem label="Validate Tradovate in demo before live" />
        </div>
      </Panel>
    </div>
  );
}

function SupportView() {
  return (
    <Panel eyebrow="Support" title="Runbook" icon={<LifeBuoy size={20} aria-hidden="true" />}>
      <div className="grid gap-3 text-sm text-slate-300">
        <p>Use Connections to add brokers and discover accounts.</p>
        <p>Use Copy Trade to confirm leader/follower routing before webhook automation.</p>
        <p>Use Risk Management before enabling live execution or flatten-all.</p>
        <p>Use Report | Journal to inspect signal-level audit records after each execution.</p>
      </div>
    </Panel>
  );
}

function BestPractices() {
  return (
    <section className="rounded-lg border border-indigo-400/30 bg-indigo-950/40 p-4">
      <p className="text-sm font-semibold text-amber-200">Best practices for accurate and safe replication</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">
        Keep broker sync current, flatten old exposure before new sessions, and verify at least one
        follower account after every live execution.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MiniPractice icon={<Shield size={15} />} title="Flatten before trading" detail="Start every session from a controlled state." />
        <MiniPractice icon={<Eye size={15} />} title="Check after execution" detail="Confirm propagation before modifying orders." />
        <MiniPractice icon={<Zap size={15} />} title="Keep sync fresh" detail="Use reconciliation before live flatten or copy routes." />
      </div>
    </section>
  );
}

function Panel({
  eyebrow,
  title,
  icon,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#1a1f1c] p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-indigo-400/15 text-indigo-200">{icon}</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-white/15 bg-[#202420] p-6 text-center">
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{detail}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "emerald" | "amber" | "rose" | "indigo" | "slate";
}) {
  const tones = {
    cyan: "text-cyan-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    indigo: "text-indigo-300",
    slate: "text-slate-200",
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#202420] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function AccountRow({ account }: { account: PropAccount }) {
  return (
    <div className="grid gap-3 rounded-md border border-white/10 bg-[#202420] p-3 text-sm md:grid-cols-[1.25fr_0.7fr_0.7fr_0.7fr]">
      <AccountName account={account} />
      <Readout label="Balance" value={money.format(account.balance)} />
      <Readout label="Daily P&L" value={money.format(account.dailyPnl)} tone={account.dailyPnl >= 0 ? "emerald" : "rose"} />
      <Readout label="Drawdown" value={`${account.drawdownUsed}%`} />
    </div>
  );
}

function AccountName({ account }: { account: PropAccount }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          account.status === "online" ? "bg-emerald-400" : account.status === "paused" ? "bg-amber-300" : "bg-rose-300"
        }`}
      />
      <div>
        <p className="font-medium text-white">{account.name}</p>
        <p className="text-xs text-slate-500">
          {account.firm} | {account.platform}
        </p>
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "emerald" | "rose";
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-sm ${tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-slate-200"}`}>
        {value}
      </p>
    </div>
  );
}

function BrokerStatusPanel({ connections }: { connections: BrokerConnection[] }) {
  return (
    <Panel eyebrow="Brokers" title="Connection status" icon={<PlugZap size={20} aria-hidden="true" />}>
      <BrokerConnectionsTable connections={connections} compact />
    </Panel>
  );
}

function BrokerConnectionsTable({
  connections,
  compact = false,
}: {
  connections: BrokerConnection[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState("");

  async function deleteConnection(connectionId: string) {
    setPendingDelete(connectionId);
    await fetch(`/api/broker-connections/${connectionId}`, { method: "DELETE" });
    setPendingDelete("");
    router.refresh();
  }

  if (!connections.length) {
    return (
      <EmptyState
        title="No broker connections"
        detail="Add Tradovate OAuth or configure a ProjectX/Rithmic bridge before any account can route live."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-white/10">
      <div className={`grid ${compact ? "grid-cols-[1fr_0.7fr_0.7fr]" : "grid-cols-[1fr_0.55fr_0.8fr_0.7fr_1fr_0.5fr]"} gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400`}>
        <span>Broker</span>
        <span>Mode</span>
        <span>Status</span>
        {!compact ? <span>Accounts</span> : null}
        {!compact ? <span>Last check</span> : null}
        {!compact ? <span>Action</span> : null}
      </div>
      {connections.map((connection) => (
        <div
          key={connection.id}
          className={`grid ${compact ? "grid-cols-[1fr_0.7fr_0.7fr]" : "grid-cols-[1fr_0.55fr_0.8fr_0.7fr_1fr_0.5fr]"} items-center gap-3 border-b border-white/10 bg-[#202420] px-3 py-3 text-sm last:border-b-0`}
        >
          <div>
            <p className="font-medium text-white">{connection.name}</p>
            <p className="text-xs text-slate-500">{connection.platform}</p>
          </div>
          <span className="font-mono text-xs text-slate-300">{connection.mode}</span>
          <span className="inline-flex items-center gap-2 text-sm text-slate-300">
            <span className={`h-2.5 w-2.5 rounded-full ${connection.status === "connected" ? "bg-emerald-400" : connection.status === "error" ? "bg-rose-300" : "bg-amber-300"}`} />
            {connection.status}
          </span>
          {!compact ? <span className="font-mono text-xs text-slate-300">{connection.accountIds.length}</span> : null}
          {!compact ? (
            <span className="font-mono text-xs text-slate-500">
              {connection.lastValidatedAt
                ? new Date(connection.lastValidatedAt).toLocaleString("en-US")
                : "not validated"}
            </span>
          ) : null}
          {!compact ? (
            <button
              type="button"
              onClick={() => deleteConnection(connection.id)}
              disabled={pendingDelete === connection.id}
              className="grid h-8 w-8 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-rose-300/40 hover:text-rose-300 disabled:opacity-60"
              aria-label={`Delete ${connection.name}`}
              title="Delete connection"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CopyLimitsBar({ workspace }: { workspace: TradingWorkspace }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#1a1f1c] p-4">
      <div className="grid gap-4 xl:grid-cols-[0.35fr_1fr_1fr]">
        <div className="rounded-md border border-white/10 bg-[#202420] p-3">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Live P&L</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">Active</p>
          <p className="mt-1 text-xs text-slate-500">global safety rails online</p>
        </div>
        <LimitGroup label="Tradovate" values={["Per minute 0 / 80", "Hourly 0 / 5,000", "Daily 0 / 120,000"]} />
        <LimitGroup label="Bridge adapters" values={[`${workspace.brokerConnections.filter((connection) => connection.mode === "live").length} live connections`, "Reconcile before flatten", "Alerts on rejected routes"]} />
      </div>
    </section>
  );
}

function LimitGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#202420] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-3 grid gap-2">
        {values.map((value) => (
          <div key={value} className="flex items-center gap-2 text-sm text-slate-300">
            <Zap size={13} className="text-amber-300" />
            {value}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaderRow({ account, rule }: { account: PropAccount; rule?: CopierRule }) {
  return (
    <div className="rounded-md border border-amber-300/20 bg-amber-300/5 p-3">
      <div className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr]">
        <AccountName account={account} />
        <Readout label="Role" value="Leader" />
        <Readout label="Followers" value={String(rule?.followerAccountIds.length ?? 0)} />
        <Readout label="Max contracts" value={String(rule?.maxContractsPerFollower ?? 0)} />
      </div>
    </div>
  );
}

function ExecutionTable({ records, empty }: { records: ExecutionRecord[]; empty: string }) {
  if (!records.length) {
    return <p className="rounded-md border border-white/10 bg-[#202420] p-3 text-sm text-slate-400">{empty}</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-white/10">
      {records.map((record) => (
        <Link
          key={record.id}
          href={`/executions/${record.signalId}`}
          className="grid gap-3 border-b border-white/10 bg-[#202420] px-3 py-3 text-sm last:border-b-0 md:grid-cols-[0.75fr_1fr_0.8fr_0.7fr]"
        >
          <span className="font-mono text-slate-500">
            {new Date(record.requestedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span className="truncate text-white">{record.accountName}</span>
          <span className="text-slate-300">
            {record.side} {record.quantity} {record.symbol}
          </span>
          <span className={statusColor(record.status)}>{record.status}</span>
        </Link>
      ))}
    </div>
  );
}

function CalendarGrid({ records }: { records: ExecutionRecord[] }) {
  const days = Array.from({ length: 35 }, (_, index) => index + 1);
  const recordsByDay = records.reduce<Record<number, number>>((groups, record) => {
    const date = new Date(record.requestedAt);
    if (date.getMonth() === 4 && date.getFullYear() === 2026) {
      const day = date.getDate();
      groups[day] = (groups[day] ?? 0) + 1;
    }
    return groups;
  }, {});

  return (
    <div className="grid grid-cols-7 overflow-hidden rounded-md border border-white/10">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div key={day} className="border-b border-white/10 bg-white/[0.03] p-2 text-center text-xs font-semibold text-slate-400">
          {day}
        </div>
      ))}
      {days.map((day) => (
        <div key={day} className="min-h-20 border-b border-r border-white/10 bg-[#202420] p-2 text-right text-xs text-slate-300">
          <span>{day}</span>
          {recordsByDay[day] ? (
            <p className="mt-2 rounded bg-indigo-400/15 px-2 py-1 text-left font-mono text-indigo-200">
              {recordsByDay[day]} exec
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MiniPractice({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-cyan-300">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-300">{detail}</p>
    </div>
  );
}

function StatusChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`hidden h-10 items-center rounded-md px-3 text-sm font-semibold sm:inline-flex ${active ? "bg-emerald-300 text-slate-950" : "bg-white/[0.06] text-slate-300"}`}>
      {label}
    </span>
  );
}

function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-md border border-white/10 bg-[#202420] p-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#202420] p-3">
      <CheckCircle2 size={15} className="text-emerald-300" />
      {label}
    </div>
  );
}

function statusColor(status: ExecutionRecord["status"]) {
  if (status === "simulated") return "text-emerald-300";
  if (status === "live_submitted") return "text-cyan-300";
  if (status === "blocked") return "text-amber-300";
  return "text-rose-300";
}
