import { McpServer } from "@modelcontextprotocol/server";

import { registerCapabilities } from "./register-capabilities";
import type { IResolvedCapabilities, IServerConfig } from "./types";

/**
 * Creates a transport-independent MCP server with resolved capabilities.
 *
 * Each call returns a new instance so the stdio factory can build a fresh
 * server per protocol negotiation. IResolvedCapabilities are already resolved through a
 * per-server container by the caller; this function only registers them.
 *
 * @param capabilities - Resolved runtime capabilities to register.
 * @param config - Caller-owned server identity advertised to MCP clients.
 * @returns A new {@link McpServer} instance with capabilities registered.
 */
export function createServer(capabilities: IResolvedCapabilities, config: IServerConfig): McpServer {
  const server = new McpServer({ name: config.name, version: config.version });

  registerCapabilities(server, capabilities);

  return server;
}
