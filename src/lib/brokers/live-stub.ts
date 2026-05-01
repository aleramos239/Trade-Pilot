import type {
  BrokerAdapter,
  BrokerFlattenRequest,
  BrokerOrderRequest,
  BrokerOrderResult,
} from "./types";
import type { BrokerConnection } from "@/lib/trading/types";

export abstract class LiveBrokerStubAdapter implements BrokerAdapter {
  constructor(public connection: BrokerConnection) {}

  async listAccounts() {
    return this.connection.accountIds;
  }

  async placeOrder(request: BrokerOrderRequest): Promise<BrokerOrderResult> {
    void request;
    return this.rejectedResult("Live order placement is disabled until this broker API is implemented.");
  }

  async flattenAccount(request: BrokerFlattenRequest): Promise<BrokerOrderResult> {
    void request;
    return this.rejectedResult("Live flattening is disabled until this broker API is implemented.");
  }

  protected rejectedResult(reason: string): BrokerOrderResult {
    return {
      brokerOrderId: null,
      status: "rejected",
      mode: "live",
      reason,
      completedAt: new Date().toISOString(),
      latencyMs: 0,
    };
  }
}
