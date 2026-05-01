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

const TRADOVATE_BASE_URL = {
  demo: "https://demo.tradovateapi.com/v1",
  live: "https://live.tradovateapi.com/v1",
};

function requireField(credentials: BrokerCredentialInput, field: keyof BrokerCredentialInput) {
  const value = credentials[field];

  if (!value) {
    throw new Error(`Tradovate ${field} is required for validation.`);
  }

  return String(value);
}

function toTradovateOrderType(orderType: BrokerOrderRequest["orderType"]) {
  if (orderType === "limit") {
    return "Limit";
  }

  if (orderType === "stop") {
    return "Stop";
  }

  return "Market";
}

function getFailureText(body: Record<string, unknown>, fallback: string) {
  if (typeof body.failureText === "string" && body.failureText) {
    return body.failureText;
  }

  if (typeof body.errorText === "string" && body.errorText) {
    return body.errorText;
  }

  if (typeof body.failureReason === "string" && body.failureReason !== "Success") {
    return body.failureReason;
  }

  return fallback;
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value);
}

function normalizeSide(value: unknown) {
  const side = String(value ?? "").toLowerCase();

  if (side === "buy") {
    return "buy";
  }

  if (side === "sell") {
    return "sell";
  }

  return "unknown";
}

function getPositionQuantity(position: Record<string, unknown>) {
  const netPos =
    asNumber(position.netPos) ??
    asNumber(position.netQuantity) ??
    asNumber(position.quantity) ??
    asNumber(position.qty);

  if (netPos !== null) {
    return netPos;
  }

  const bought = asNumber(position.bought) ?? 0;
  const sold = asNumber(position.sold) ?? 0;
  return bought - sold;
}

function getPositionSide(quantity: number) {
  if (quantity > 0) {
    return "long";
  }

  if (quantity < 0) {
    return "short";
  }

  return "flat";
}

export class TradovateAdapter extends LiveBrokerStubAdapter {
  private async requestAccessToken(credentials: BrokerCredentialInput) {
    const environment = credentials.environment ?? "demo";
    const response = await fetch(`${TRADOVATE_BASE_URL[environment]}/auth/accessTokenRequest`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: requireField(credentials, "username"),
        password: requireField(credentials, "password"),
        appId: requireField(credentials, "appId"),
        appVersion: credentials.appVersion || "1.0",
        cid: Number(credentials.cid ?? 0),
        sec: requireField(credentials, "apiSecret"),
        deviceId: credentials.deviceId,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return { environment, response, body };
  }

  private async getAccessToken(credentials: BrokerCredentialInput) {
    const { environment, response, body } = await this.requestAccessToken(credentials);

    if (!response.ok || typeof body.accessToken !== "string") {
      throw new Error(
        typeof body.errorText === "string"
          ? body.errorText
          : `Tradovate token request failed with HTTP ${response.status}.`,
      );
    }

    return {
      accessToken: body.accessToken,
      baseUrl: TRADOVATE_BASE_URL[environment],
    };
  }

  private async resolveContract(baseUrl: string, accessToken: string, symbol: string) {
    const url = new URL(`${baseUrl}/contract/suggest`);
    url.searchParams.set("t", symbol);
    url.searchParams.set("l", "1");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = (await response.json().catch(() => [])) as Record<string, unknown>[];

    if (!response.ok || !Array.isArray(body) || !body.length) {
      throw new Error(`Tradovate contract lookup failed for ${symbol}.`);
    }

    return {
      id: typeof body[0].id === "number" ? body[0].id : null,
      name: String(body[0].name ?? symbol),
      raw: body[0],
    };
  }

  private async getOrderStatus(baseUrl: string, accessToken: string, orderId: number) {
    const url = new URL(`${baseUrl}/order/item`);
    url.searchParams.set("id", String(orderId));

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return {
      ok: response.ok,
      status: typeof body.ordStatus === "string" ? body.ordStatus : null,
      raw: body,
    };
  }

  private async getJsonList(baseUrl: string, accessToken: string, path: string, params = {}) {
    const url = new URL(`${baseUrl}${path}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = await response.json().catch(() => []);

    if (!response.ok || !Array.isArray(body)) {
      throw new Error(`${path} failed with HTTP ${response.status}.`);
    }

    return asRecordArray(body);
  }

  private async getContractNames(baseUrl: string, accessToken: string, contractIds: string[]) {
    const uniqueIds = [...new Set(contractIds.filter(Boolean))];

    if (!uniqueIds.length) {
      return new Map<string, string>();
    }

    const contracts = await this.getJsonList(baseUrl, accessToken, "/contract/items", {
      ids: uniqueIds.join(","),
    });

    return new Map(
      contracts
        .map((contract) => [asStringId(contract.id), String(contract.name ?? "")] as const)
        .filter(([id, name]) => Boolean(id && name)) as [string, string][],
    );
  }

  async validateCredentials(credentials: BrokerCredentialInput): Promise<BrokerValidationResult> {
    const checkedAt = new Date().toISOString();

    try {
      const { response, body } = await this.requestAccessToken(credentials);

      if (!response.ok || !body.accessToken) {
        return {
          ok: false,
          status: "error",
          message:
            typeof body.errorText === "string"
              ? body.errorText
              : `Tradovate validation failed with HTTP ${response.status}.`,
          checkedAt,
          raw: body,
        };
      }

      return {
        ok: true,
        status: "connected",
        message: "Tradovate credentials validated. Live order placement is safety-gated.",
        checkedAt,
        raw: {
          userId: body.userId,
          name: body.name,
          userStatus: body.userStatus,
          expirationTime: body.expirationTime,
        },
      };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "Tradovate validation failed.",
        checkedAt,
      };
    }
  }

  async placeOrder(order: BrokerOrderRequest): Promise<BrokerOrderResult> {
    const startedAt = Date.now();

    try {
      if (!order.credentials) {
        return this.rejectedResult("Tradovate credentials were not available for this live route.");
      }

      if (!order.brokerAccountId) {
        return this.rejectedResult("Tradovate broker account mapping is required.");
      }

      const accountId = Number(order.brokerAccountId);

      if (!Number.isSafeInteger(accountId)) {
        return this.rejectedResult("Tradovate account id must be numeric.");
      }

      if (order.orderType !== "market" && order.price === undefined) {
        return this.rejectedResult(`${order.orderType} orders require a price.`);
      }

      const { accessToken, baseUrl } = await this.getAccessToken(order.credentials);
      const contract = await this.resolveContract(baseUrl, accessToken, order.symbol);
      const orderBody: Record<string, unknown> = {
        accountSpec: order.credentials.username ?? order.accountName,
        accountId,
        action: order.side === "buy" ? "Buy" : "Sell",
        symbol: contract.name,
        orderQty: order.quantity,
        orderType: toTradovateOrderType(order.orderType),
        isAutomated: true,
        customTag50: `TC-${order.requestedAt.replace(/\D/g, "").slice(0, 14)}`,
      };

      if (order.orderType !== "market") {
        orderBody.price = order.price;
      }

      const response = await fetch(`${baseUrl}/order/placeorder`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderBody),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const orderId = Number(body.orderId);
      const failureReason = typeof body.failureReason === "string" ? body.failureReason : "";

      if (
        !response.ok ||
        !Number.isSafeInteger(orderId) ||
        (failureReason && failureReason !== "Success")
      ) {
        return {
          brokerOrderId: Number.isSafeInteger(orderId) ? String(orderId) : null,
          status: "rejected",
          mode: "live",
          reason: getFailureText(
            body,
            `Tradovate order rejected with HTTP ${response.status}.`,
          ),
          completedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          raw: {
            placeOrder: body,
            contract,
          },
        };
      }

      const orderStatus = await this.getOrderStatus(baseUrl, accessToken, orderId);

      return {
        brokerOrderId: String(orderId),
        status: "live_submitted",
        mode: "live",
        reason: orderStatus.status
          ? `Tradovate accepted order ${orderId}; status ${orderStatus.status}.`
          : `Tradovate accepted order ${orderId}.`,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        brokerOrderStatus: orderStatus.status,
        raw: {
          placeOrder: body,
          orderStatus: orderStatus.raw,
          contract,
        },
      };
    } catch (error) {
      return {
        brokerOrderId: null,
        status: "rejected",
        mode: "live",
        reason: error instanceof Error ? error.message : "Tradovate live order failed.",
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  async flattenAccount(request: BrokerFlattenRequest): Promise<BrokerOrderResult> {
    const startedAt = Date.now();

    try {
      if (!request.credentials) {
        return this.rejectedResult("Tradovate credentials were not available for flattening.");
      }

      const positionIds =
        request.positionIds
          ?.map((positionId) => Number(positionId))
          .filter((positionId) => Number.isSafeInteger(positionId)) ?? [];

      if (!positionIds.length) {
        return this.rejectedResult(
          "Tradovate flattening requires explicit open position ids from the broker.",
        );
      }

      const { accessToken, baseUrl } = await this.getAccessToken(request.credentials);
      const response = await fetch(`${baseUrl}/order/liquidatepositions`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          positions: positionIds,
          admin: true,
          customTag50: `TC-FLAT-${request.requestedAt.replace(/\D/g, "").slice(0, 10)}`,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const ok = response.ok && body.ok === true;

      return {
        brokerOrderId: null,
        status: ok ? "live_submitted" : "rejected",
        mode: "live",
        reason: ok
          ? "Tradovate liquidate-positions request accepted."
          : getFailureText(body, `Tradovate liquidate-positions failed with HTTP ${response.status}.`),
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        raw: body,
      };
    } catch (error) {
      return {
        brokerOrderId: null,
        status: "rejected",
        mode: "live",
        reason: error instanceof Error ? error.message : "Tradovate flatten request failed.",
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    }
  }

  async reconcileAccounts(credentials: BrokerCredentialInput): Promise<BrokerReconciliationResult> {
    const syncedAt = new Date().toISOString();

    try {
      const { accessToken, baseUrl } = await this.getAccessToken(credentials);
      const accountIds = this.connection.accountIds
        .map((accountId) => Number(accountId))
        .filter((accountId) => Number.isSafeInteger(accountId));

      if (!accountIds.length) {
        return {
          ok: false,
          status: "error",
          message: "No numeric Tradovate account ids are mapped to this connection.",
          syncedAt,
          positions: [],
          orders: [],
          fills: [],
        };
      }

      const positionLists = await Promise.all(
        accountIds.map((accountId) =>
          this.getJsonList(baseUrl, accessToken, "/position/deps", { masterid: accountId }).catch(
            () => [],
          ),
        ),
      );
      const orderLists = await Promise.all(
        accountIds.map((accountId) =>
          this.getJsonList(baseUrl, accessToken, "/order/deps", { masterid: accountId }),
        ),
      );
      const positions = positionLists.flat();
      const rawOrders = orderLists.flat();
      const recentOrders = rawOrders
        .sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")))
        .slice(0, 100);
      const fills = await this.getJsonList(baseUrl, accessToken, "/fill/list").catch(() => []);
      const contractIds = [
        ...positions.map((position) => asStringId(position.contractId)),
        ...recentOrders.map((order) => asStringId(order.contractId)),
        ...fills.map((fill) => asStringId(fill.contractId)),
      ].filter(Boolean) as string[];
      const contractNames = await this.getContractNames(baseUrl, accessToken, contractIds).catch(
        () => new Map<string, string>(),
      );
      const orderAccountById = new Map(
        rawOrders
          .map((order) => [asStringId(order.id), asStringId(order.accountId)] as const)
          .filter(([orderId, accountId]) => Boolean(orderId && accountId)) as [string, string][],
      );
      const accountIdSet = new Set(accountIds.map(String));
      const recentFills = fills
        .filter((fill) => {
          const orderId = asStringId(fill.orderId);
          const accountId = orderId ? orderAccountById.get(orderId) : null;
          return !accountId || accountIdSet.has(accountId);
        })
        .sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")))
        .slice(0, 100);

      return {
        ok: true,
        status: "connected",
        message: `Synced ${positions.length} positions, ${recentOrders.length} orders, and ${recentFills.length} fills.`,
        syncedAt,
        positions: positions.map((position) => {
          const quantity = getPositionQuantity(position);
          const contractId = asStringId(position.contractId);

          return {
            platform: "Tradovate",
            brokerAccountId: String(position.accountId ?? ""),
            brokerPositionId: String(position.id ?? `${position.accountId ?? "account"}-${contractId ?? "contract"}`),
            contractId,
            symbol: contractId ? contractNames.get(contractId) ?? contractId : "UNKNOWN",
            side: getPositionSide(quantity),
            quantity: Math.abs(quantity),
            averagePrice: asNumber(position.netPrice) ?? asNumber(position.price),
            active: position.active === undefined ? quantity !== 0 : Boolean(position.active),
            raw: position,
          };
        }),
        orders: recentOrders.map((order) => {
          const contractId = asStringId(order.contractId);

          return {
            platform: "Tradovate",
            brokerAccountId: String(order.accountId ?? ""),
            brokerOrderId: String(order.id ?? ""),
            contractId,
            symbol: contractId ? contractNames.get(contractId) ?? contractId : "UNKNOWN",
            side: normalizeSide(order.action),
            status: String(order.ordStatus ?? "Unknown"),
            raw: order,
          };
        }),
        fills: recentFills.map((fill) => {
          const contractId = asStringId(fill.contractId);
          const brokerOrderId = asStringId(fill.orderId);

          return {
            platform: "Tradovate",
            brokerAccountId: brokerOrderId ? orderAccountById.get(brokerOrderId) ?? null : null,
            brokerOrderId,
            brokerFillId: String(fill.id ?? ""),
            contractId,
            symbol: contractId ? contractNames.get(contractId) ?? contractId : "UNKNOWN",
            side: normalizeSide(fill.action),
            quantity: asNumber(fill.qty) ?? 0,
            price: asNumber(fill.price),
            raw: fill,
          };
        }),
        raw: {
          accountIds,
          positionCount: positions.length,
          orderCount: recentOrders.length,
          fillCount: recentFills.length,
        },
      };
    } catch (error) {
      return {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "Tradovate reconciliation failed.",
        syncedAt,
        positions: [],
        orders: [],
        fills: [],
      };
    }
  }

  async discoverAccounts(credentials: BrokerCredentialInput): Promise<BrokerDiscoveryResult> {
    const checkedAt = new Date().toISOString();

    try {
      const { environment, response, body } = await this.requestAccessToken(credentials);

      if (!response.ok || !body.accessToken) {
        return {
          ok: false,
          status: "error",
          message:
            typeof body.errorText === "string"
              ? body.errorText
              : `Tradovate token request failed with HTTP ${response.status}.`,
          checkedAt,
          accounts: [],
        };
      }

      const accountResponse = await fetch(`${TRADOVATE_BASE_URL[environment]}/account/list`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${body.accessToken}`,
        },
      });
      const accounts = (await accountResponse.json().catch(() => [])) as Record<string, unknown>[];

      if (!accountResponse.ok || !Array.isArray(accounts)) {
        return {
          ok: false,
          status: "error",
          message: `Tradovate account discovery failed with HTTP ${accountResponse.status}.`,
          checkedAt,
          accounts: [],
        };
      }

      return {
        ok: true,
        status: "connected",
        message: `Discovered ${accounts.length} Tradovate account${accounts.length === 1 ? "" : "s"}.`,
        checkedAt,
        accounts: accounts.map((account) => {
          const brokerAccountId = String(account.id ?? account.accountId ?? account.name ?? "");

          return {
            platform: "Tradovate",
            brokerAccountId,
            name: String(account.name ?? account.nickname ?? `Tradovate ${brokerAccountId}`),
            accountNumber:
              account.accountNumber === undefined ? null : String(account.accountNumber),
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
        message: error instanceof Error ? error.message : "Tradovate account discovery failed.",
        checkedAt,
        accounts: [],
      };
    }
  }
}
