import { randomUUID } from "node:crypto";
import type {
  BrokerAdapter,
  BrokerFlattenRequest,
  BrokerOrderRequest,
  BrokerOrderResult,
} from "./types";
import type { BrokerConnection } from "@/lib/trading/types";

export class SimulatedBrokerAdapter implements BrokerAdapter {
  constructor(public connection: BrokerConnection) {}

  async listAccounts() {
    return this.connection.accountIds;
  }

  async placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const completedAt = new Date().toISOString();

    if (this.connection.status !== "connected") {
      return {
        brokerOrderId: null,
        status: "rejected",
        mode: this.connection.mode,
        reason: `${this.connection.name} is ${this.connection.status}.`,
        completedAt,
        latencyMs: 0,
      };
    }

    if (!this.connection.accountIds.includes(order.brokerAccountId ?? order.accountId)) {
      return {
        brokerOrderId: null,
        status: "rejected",
        mode: this.connection.mode,
        reason: "Account is not mapped to this broker connection.",
        completedAt,
        latencyMs: 0,
      };
    }

    return {
      brokerOrderId: `SIM-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "simulated",
      mode: "simulation",
      reason: "Order accepted by simulated broker adapter.",
      completedAt,
      latencyMs: Math.max(15, Math.min(90, order.quantity * 9 + order.symbol.length * 4)),
    };
  }

  async flattenAccount(request: BrokerFlattenRequest) {
    return this.placeOrder({
      accountId: request.accountId,
      accountName: request.accountId,
      brokerAccountId: request.brokerAccountId,
      platform: this.connection.platform,
      symbol: "ALL",
      side: "sell",
      quantity: 0,
      orderType: "market",
      requestedAt: request.requestedAt,
    });
  }
}
