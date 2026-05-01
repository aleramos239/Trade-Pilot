import type { BrokerConnection, CopierRule, PropAccount, RecentExecution, User } from "./types";

export const demoUser: User = {
  id: "user-demo",
  workspaceId: "workspace-demo",
  name: "Demo Operator",
  email: "operator@tradecopilot.local",
  role: "owner",
  webhookSecret: "demo-webhook-secret",
};

export const propAccounts: PropAccount[] = [];

export const copierRules: CopierRule[] = [];

export const brokerConnections: BrokerConnection[] = [];

export const recentExecutions: RecentExecution[] = [];
