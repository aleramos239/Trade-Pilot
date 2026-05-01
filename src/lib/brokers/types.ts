import type {
  BrokerConnection,
  BrokerMode,
  BrokerPlatform,
  BrokerFillSnapshot,
  BrokerOrderSnapshot,
  BrokerPositionSnapshot,
  DiscoveredBrokerAccount,
  OrderSide,
  OrderType,
} from "@/lib/trading/types";
import type { BrokerCredentialInput } from "@/lib/security/credential-vault";

export type BrokerOrderRequest = {
  accountId: string;
  accountName: string;
  brokerAccountId?: string | null;
  credentials?: BrokerCredentialInput;
  platform: BrokerPlatform;
  symbol: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  price?: number;
  requestedAt: string;
};

export type BrokerFlattenRequest = {
  accountId: string;
  brokerAccountId?: string | null;
  credentials?: BrokerCredentialInput;
  positionIds?: string[];
  requestedAt: string;
};

export type BrokerOrderResult = {
  brokerOrderId: string | null;
  status: "simulated" | "live_submitted" | "rejected";
  mode: BrokerMode;
  reason: string;
  completedAt: string;
  latencyMs: number;
  brokerOrderStatus?: string | null;
  raw?: Record<string, unknown>;
};

export type BrokerValidationResult = {
  ok: boolean;
  status: "connected" | "disconnected" | "error";
  message: string;
  checkedAt: string;
  accountIds?: string[];
  raw?: Record<string, unknown>;
};

export type BrokerDiscoveryResult = {
  ok: boolean;
  status: "connected" | "disconnected" | "error";
  message: string;
  checkedAt: string;
  accounts: Omit<DiscoveredBrokerAccount, "id" | "ownerId" | "brokerConnectionId" | "discoveredAt">[];
};

export type BrokerReconciliationResult = {
  ok: boolean;
  status: "connected" | "disconnected" | "error";
  message: string;
  syncedAt: string;
  positions: Omit<BrokerPositionSnapshot, "id" | "ownerId" | "brokerConnectionId" | "syncedAt">[];
  orders: Omit<BrokerOrderSnapshot, "id" | "ownerId" | "brokerConnectionId" | "syncedAt">[];
  fills: Omit<BrokerFillSnapshot, "id" | "ownerId" | "brokerConnectionId" | "syncedAt">[];
  raw?: Record<string, unknown>;
};

export type BrokerAdapter = {
  connection: BrokerConnection;
  listAccounts(): Promise<string[]>;
  validateCredentials?(credentials: BrokerCredentialInput): Promise<BrokerValidationResult>;
  discoverAccounts?(credentials: BrokerCredentialInput): Promise<BrokerDiscoveryResult>;
  reconcileAccounts?(credentials: BrokerCredentialInput): Promise<BrokerReconciliationResult>;
  placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult>;
  flattenAccount(request: BrokerFlattenRequest): Promise<BrokerOrderResult>;
};
