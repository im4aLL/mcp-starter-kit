import type { McpServerFactory } from "@modelcontextprotocol/server";
import { type StdioServerHandle, serveStdio } from "@modelcontextprotocol/server/stdio";

import { logger } from "../../utils/logger";

/**
 * Starts an MCP server over stdio using a caller-supplied server factory.
 *
 * The factory is invoked by the SDK, possibly more than once during protocol
 * negotiation, so it must return a fresh {@link McpServer} each call. All
 * diagnostics go to stderr through the shared logger; the transport itself
 * owns stdout. Signal-driven shutdown is deferred to a later task.
 *
 * @param createServer - Factory that returns a new MCP server per invocation.
 * @returns The stdio server handle, so callers can close the connection.
 */
export function startStdio(createServer: McpServerFactory): StdioServerHandle {
  const handle = serveStdio(createServer, {
    onerror: (error) => {
      logger.error({ err: error }, "stdio transport error");
    },
  });

  logger.info("stdio transport started");

  return handle;
}
