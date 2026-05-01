import { LiveBrokerStubAdapter } from "./live-stub";
import type {
  BrokerDiscoveryResult,
  BrokerFlattenRequest,
  BrokerOrderRequest,
  BrokerOrderResult,
  BrokerReconciliationResult,
  BrokerValidationResult,
} from "./types";
import type { BrokerCredentialInput } from "@/lib/security/credential-vault";

function requireBridgeUrl(credentials: BrokerCredentialInput, platform: string) {
  const bridgeUrl = credentials.bridgeUrl?.replace(/\/$/, "");

  if (!bridgeUrl) {
    throw new Error(`${platform} requires a broker bridge URL.`);
  }

  return bridgeUrl;
}

function headers(credentials: BrokerCredentialInput) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(credentials.apiKey ? { Authorization: `Bearer ${credentials.apiKey}` } : {}),
    ...(credentials.apiSecret ? { "x-api-secret": credentials.apiSecret } : {}),
  };
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export abstract class HttpBridgeBrokerAdapter extends LiveBrokerStubAdapter {
  protected get platformName() {
    return this.connection.platform;
  }

  async validateCredentials(credentials: BrokerCredentialInput): Promise<BrokerValidationResult> {
    const checkedAt = new Date().toISOString();

    try {
      const bridgeUrl = requireBridgeUrl(credentials, this.platformName);
      const response = await fetch(`${bridgeUrl}/validate`, {
        method: "POST",
        headers: headers(credentials),
        body: JSON.stringify({
          platform: this.connection.platform,
          environment: credentials.environment ?? "demo",
          username: credentials.username,
        }),
      });
      const body = await readJson(response);

      return {
        ok: response.ok && body.ok !== false,
        status: response.ok && body.ok !== false ? "connected" : "error",
        message:
          typeof body.message === "string"
            ? body.message
            : `${this.platformName} bridge validation ${response.ok ? "completed" : "failed"}.`,
        checkedAt,
        accountIds: Array.isArray(body.accountIds) ? body.accountIds.map(String) : undefined,
        raw: body,
      };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : `${this.platformName} validation failed.`,
        checkedAt,
      };
    }
  }

  async discoverAccounts(credentials: BrokerCredentialInput): Promise<BrokerDiscoveryResult> {
    const checkedAt = new Date().toISOString();

    try {
      const bridgeUrl = requireBridgeUrl(credentials, this.platformName);
      const response = await fetch(`${bridgeUrl}/accounts`, {
        headers: headers(credentials),
      });
      const body = await readJson(response);
      const accounts = Array.isArray(body.accounts) ? body.accounts as Record<string, unknown>[] : [];

      return {
        ok: response.ok,
        status: response.ok ? "connected" : "error",
        message:
          typeof body.message === "string"
            ? body.message
            : `Discovered ${accounts.length} ${this.platformName} bridge account${accounts.length === 1 ? "" : "s"}.`,
        checkedAt,
        accounts: accounts.map((account) => {
          const brokerAccountId = String(account.id ?? account.accountId ?? account.name ?? "");

          return {
            platform: this.connection.platform,
            brokerAccountId,
            name: String(account.name ?? account.nickname ?? `${this.platformName} ${brokerAccountId}`),
            accountNumber: account.accountNumber === undefined ? null : String(account.accountNumber),
            accountType: account.accountType === undefined ? null : String(account.accountType),
            active: account.active === undefined ? true : Boolean(account.active),
            raw: account,
          };
        }),
      };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : `${this.platformName} account discovery failed.`,
        checkedAt,
        accounts: [],
      };
    }
  }

  async reconcileAccounts(credentials: BrokerCredentialInput): Promise<BrokerReconciliationResult> {
    const syncedAt = new Date().toISOString();

    try {
      const bridgeUrl = requireBridgeUrl(credentials, this.platformName);
      const url = new URL(`${bridgeUrl}/reconcile`);
      url.searchParams.set("accountIds", this.connection.accountIds.join(","));
      const response = await fetch(url, { headers: headers(credentials) });
      const body = await readJson(response);

      return {
        ok: response.ok && body.ok !== false,
        status: response.ok && body.ok !== false ? "connected" : "error",
        message:
          typeof body.message === "string"
            ? body.message
            : `${this.platformName} bridge reconciliation ${response.ok ? "completed" : "failed"}.`,
        syncedAt,
        positions: Array.isArray(body.positions) ? body.positions as BrokerReconciliationResult["positions"] : [],
        orders: Array.isArray(body.orders) ? body.orders as BrokerReconciliationResult["orders"] : [],
        fills: Array.isArray(body.fills) ? body.fills as BrokerReconciliationResult["fills"] : [],
        raw: body,
      };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : `${this.platformName} reconciliation failed.`,
        syncedAt,
        positions: [],
        orders: [],
        fills: [],
      };
    }
  }

  async placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const startedAt = Date.now();

    try {
      if (!order.credentials) {
        return this.rejectedResult(`${this.platformName} bridge credentials are missing.`);
      }

      const bridgeUrl = requireBridgeUrl(order.credentials, this.platformName);
      const response = await fetch(`${bridgeUrl}/orders`, {
        method: "POST",
        headers: headers(order.credentials),
        body: JSON.stringify({
          accountId: order.brokerAccountId ?? order.accountId,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          orderType: order.orderType,
          price: order.price,
          requestedAt: order.requestedAt,
        }),
      });
      const body = await readJson(response);
      const ok = response.ok && body.ok !== false;

      return {
        brokerOrderId: body.orderId === undefined ? null : String(body.orderId),
        status: ok ? "live_submitted" : "rejected",
        mode: "live",
        reason:
          typeof body.message === "string"
            ? body.message
            : `${this.platformName} bridge order ${ok ? "submitted" : "rejected"}.`,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        brokerOrderStatus: body.status === undefined ? null : String(body.status),
        raw: body,
      };
    } catch (error) {
      return {
        brokerOrderId: null,
        status: "rejected",
        mode: "live",
        reason: error instanceof Error ? error.message : `${this.platformName} bridge order failed.`,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  async flattenAccount(request: BrokerFlattenRequest): Promise<BrokerOrderResult> {
    const startedAt = Date.now();

    try {
      if (!request.credentials) {
        return this.rejectedResult(`${this.platformName} bridge credentials are missing.`);
      }

      const bridgeUrl = requireBridgeUrl(request.credentials, this.platformName);
      const response = await fetch(`${bridgeUrl}/flatten`, {
        method: "POST",
        headers: headers(request.credentials),
        body: JSON.stringify({
          accountId: request.brokerAccountId ?? request.accountId,
          positionIds: request.positionIds ?? [],
          requestedAt: request.requestedAt,
        }),
      });
      const body = await readJson(response);
      const ok = response.ok && body.ok !== false;

      return {
        brokerOrderId: body.orderId === undefined ? null : String(body.orderId),
        status: ok ? "live_submitted" : "rejected",
        mode: "live",
        reason:
          typeof body.message === "string"
            ? body.message
            : `${this.platformName} bridge flatten ${ok ? "submitted" : "rejected"}.`,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        raw: body,
      };
    } catch (error) {
      return {
        brokerOrderId: null,
        status: "rejected",
        mode: "live",
        reason: error instanceof Error ? error.message : `${this.platformName} bridge flatten failed.`,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}
