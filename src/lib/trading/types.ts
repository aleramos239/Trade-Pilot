export type BrokerPlatform =
  | "Tradovate"
  | "Rithmic"
  | "ProjectX"
  | "TradeLocker"
  | "Interactive Brokers";

export type AccountStatus = "online" | "paused" | "locked";

export type OrderSide = "buy" | "sell";

export type OrderType = "market" | "limit" | "stop";

export type PropAccount = {
  id: string;
  ownerId: string;
  name: string;
  firm: string;
  platform: BrokerPlatform;
  status: AccountStatus;
  balance: number;
  dailyPnl: number;
  drawdownUsed: number;
  maxDailyLoss: number;
  trailingDrawdownLimit: number;
  multiplier: number;
  copyEnabled: boolean;
  latencyMs: number;
};

export type CopierRule = {
  id: string;
  ownerId: string;
  name: string;
  leaderAccountId: string;
  followerAccountIds: string[];
  symbolMap: Record<string, string>;
  maxContractsPerFollower: number;
  copyStopsAndTargets: boolean;
  autoFlattenOnRuleBreach: boolean;
  enabled: boolean;
};

export type AutomationSignal = {
  source: "tradingview" | "manual" | "strategy";
  strategy: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
  stopLossTicks?: number;
  takeProfitTicks?: number;
  timestamp: string;
};

export type ExecutionDecision = {
  accountId: string;
  accountName: string;
  firm: string;
  platform: BrokerPlatform;
  symbol: string;
  quantity: number;
  side: OrderSide;
  action: "queued" | "blocked";
  reason: string;
  latencyMs: number;
  riskAfterOrder: {
    dailyLossBuffer: number;
    drawdownRemaining: number;
  };
};

export type ExecutionPlan = {
  accepted: boolean;
  receivedSignal: AutomationSignal;
  leaderAccountId: string;
  generatedAt: string;
  decisions: ExecutionDecision[];
  warnings: string[];
};

export type BrokerMode = "simulation" | "live";

export type BrokerConnectionStatus = "connected" | "disconnected" | "error";

export type BrokerConnection = {
  id: string;
  ownerId: string;
  name: string;
  platform: BrokerPlatform;
  mode: BrokerMode;
  status: BrokerConnectionStatus;
  accountIds: string[];
  credentialVaultId: string | null;
  liveEnabled: boolean;
  lastError: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  lastHeartbeatAt: string;
};

export type EncryptedPayload = {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type BrokerCredentialVaultEntry = {
  id: string;
  ownerId: string;
  brokerConnectionId: string;
  platform: BrokerPlatform;
  label: string;
  encryptedPayload: EncryptedPayload;
  createdAt: string;
  rotatedAt: string;
};

export type DiscoveredBrokerAccount = {
  id: string;
  ownerId: string;
  brokerConnectionId: string;
  platform: BrokerPlatform;
  brokerAccountId: string;
  name: string;
  accountNumber: string | null;
  accountType: string | null;
  active: boolean;
  raw: Record<string, unknown>;
  discoveredAt: string;
};

export type AccountMapping = {
  id: string;
  ownerId: string;
  appAccountId: string;
  brokerConnectionId: string;
  brokerAccountId: string;
  platform: BrokerPlatform;
  createdAt: string;
  updatedAt: string;
};

export type BrokerPositionSnapshot = {
  id: string;
  ownerId: string;
  brokerConnectionId: string;
  platform: BrokerPlatform;
  brokerAccountId: string;
  brokerPositionId: string;
  contractId: string | null;
  symbol: string;
  side: "long" | "short" | "flat" | "unknown";
  quantity: number;
  averagePrice: number | null;
  active: boolean;
  raw: Record<string, unknown>;
  syncedAt: string;
};

export type BrokerOrderSnapshot = {
  id: string;
  ownerId: string;
  brokerConnectionId: string;
  platform: BrokerPlatform;
  brokerAccountId: string;
  brokerOrderId: string;
  contractId: string | null;
  symbol: string;
  side: OrderSide | "unknown";
  status: string;
  raw: Record<string, unknown>;
  syncedAt: string;
};

export type BrokerFillSnapshot = {
  id: string;
  ownerId: string;
  brokerConnectionId: string;
  platform: BrokerPlatform;
  brokerAccountId: string | null;
  brokerOrderId: string | null;
  brokerFillId: string;
  contractId: string | null;
  symbol: string;
  side: OrderSide | "unknown";
  quantity: number;
  price: number | null;
  raw: Record<string, unknown>;
  syncedAt: string;
};

export type ExecutionRecordStatus =
  | "simulated"
  | "live_submitted"
  | "blocked"
  | "rejected"
  | "safety_blocked";

export type ExecutionRecord = {
  id: string;
  ownerId: string;
  signalId: string;
  brokerConnectionId: string | null;
  accountId: string;
  accountName: string;
  brokerAccountId: string | null;
  platform: BrokerPlatform;
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  status: ExecutionRecordStatus;
  mode: BrokerMode;
  brokerOrderId: string | null;
  reason: string;
  requestedAt: string;
  completedAt: string;
  latencyMs: number;
  brokerRaw: Record<string, unknown> | null;
};

export type ExecutionRouteResult = {
  signalId: string;
  records: ExecutionRecord[];
  summary: {
    simulated: number;
    liveSubmitted: number;
    blocked: number;
    rejected: number;
    safetyBlocked: number;
  };
};

export type ExecutionAudit = {
  id: string;
  ownerId: string;
  signalId: string;
  source: "webhook" | "flatten_all" | "manual";
  idempotencyKey: string | null;
  duplicate: boolean;
  payload: Record<string, unknown>;
  executionPlan: ExecutionPlan | null;
  routeSummary: ExecutionRouteResult["summary"];
  createdAt: string;
};

export type SafetySettings = {
  ownerId: string;
  globalKillSwitch: boolean;
  liveTradingUnlocked: boolean;
  maxOrderQuantity: number;
  minSecondsBetweenOrders: number;
  duplicateWindowSeconds: number;
  flattenAllRequestedAt: string | null;
};

export type IdempotencyRecord = {
  id: string;
  ownerId: string;
  key: string;
  firstSeenAt: string;
  lastSeenAt: string;
  routeSignalId: string | null;
};

export type User = {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: "owner" | "operator";
  webhookSecret: string;
};

export type OperatorAlert = {
  id: string;
  ownerId: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged";
  source: "auth" | "broker_sync" | "execution" | "safety" | "system";
  title: string;
  message: string;
  relatedSignalId: string | null;
  brokerConnectionId: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
};

export type Session = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type RecentExecution = {
  id: string;
  ownerId: string;
  time: string;
  strategy: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  copied: number;
  blocked: number;
  status: string;
};

export type TradingWorkspace = {
  user: User;
  accounts: PropAccount[];
  copierRules: CopierRule[];
  brokerConnections: BrokerConnection[];
  discoveredBrokerAccounts: DiscoveredBrokerAccount[];
  accountMappings: AccountMapping[];
  brokerPositions: BrokerPositionSnapshot[];
  brokerOrders: BrokerOrderSnapshot[];
  brokerFills: BrokerFillSnapshot[];
  safetySettings: SafetySettings;
  executionRecords: ExecutionRecord[];
  executionAudits: ExecutionAudit[];
  alerts: OperatorAlert[];
  recentExecutions: RecentExecution[];
};

export type AppData = {
  users: User[];
  sessions: Session[];
  propAccounts: PropAccount[];
  copierRules: CopierRule[];
  brokerConnections: BrokerConnection[];
  credentialVault: BrokerCredentialVaultEntry[];
  discoveredBrokerAccounts: DiscoveredBrokerAccount[];
  accountMappings: AccountMapping[];
  brokerPositions: BrokerPositionSnapshot[];
  brokerOrders: BrokerOrderSnapshot[];
  brokerFills: BrokerFillSnapshot[];
  safetySettings: SafetySettings[];
  idempotencyRecords: IdempotencyRecord[];
  executionRecords: ExecutionRecord[];
  executionAudits: ExecutionAudit[];
  alerts: OperatorAlert[];
  recentExecutions: RecentExecution[];
};
