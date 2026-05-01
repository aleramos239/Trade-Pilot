import { SimulatedBrokerAdapter } from "./simulated";
import { ProjectXAdapter } from "./projectx";
import { RithmicAdapter } from "./rithmic";
import { TradovateAdapter } from "./tradovate";
import type { BrokerAdapter } from "./types";
import type { BrokerConnection, BrokerPlatform } from "@/lib/trading/types";

export function createBrokerAdapter(connection: BrokerConnection): BrokerAdapter {
  if (connection.mode === "simulation") {
    return new SimulatedBrokerAdapter(connection);
  }

  if (connection.platform === "Tradovate") {
    return new TradovateAdapter(connection);
  }

  if (connection.platform === "Rithmic") {
    return new RithmicAdapter(connection);
  }

  if (connection.platform === "ProjectX") {
    return new ProjectXAdapter(connection);
  }

  throw new Error(`${connection.platform} live adapter stub is not available yet.`);
}

export function findConnectionForAccount(
  connections: BrokerConnection[],
  platform: BrokerPlatform,
  accountId: string,
) {
  return connections.find(
    (connection) =>
      connection.platform === platform &&
      connection.status === "connected" &&
      connection.accountIds.includes(accountId),
  );
}
