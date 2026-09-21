import type { McpServerFactory } from "@modelcontextprotocol/server";
import { type StdioServerHandle, serveStdio } from "@modelcontextprotocol/server/stdio";
import pino from "pino";

/**
 * Narrow logging port consumed by the stdio transport.
 *
 * The transport depends on this framework-local contract instead of the
 * application logger so core never reaches into application-owned
 * configuration. Callers may inject their own implementation; the default
 * writes to stderr.
 */
export interface IStdioLogger {
  info(bindings: Record<string, unknown>, message: string): void;
  error(bindings: Record<string, unknown>, message: string): void;
}

/**
 * Creates the framework-local logger used when no logger is injected.
 *
 * Writes newline-delimited JSON to file descriptor 2 so stdout stays reserved
 * for JSON-RPC, and reads the level from `LOG_LEVEL`.
 *
 * @returns A stderr logger satisfying {@link IStdioLogger}.
 */
function createStdioLogger(): IStdioLogger {
  return pino({ level: process.env.LOG_LEVEL ?? "info" }, pino.destination(2));
}

const defaultStdioLogger: IStdioLogger = createStdioLogger();

/**
 * Starts an MCP server over stdio using a caller-supplied server factory.
 *
 * The factory is invoked by the SDK, possibly more than once during protocol
 * negotiation, so it must return a fresh {@link McpServer} each call. The
 * transport does not own a container: every factory invocation creates its own.
 * Diagnostics go to stderr through the supplied logger; stdout stays reserved
 * for JSON-RPC. `SIGINT` and `SIGTERM` are handled here with one shared guard so
 * the returned handle is closed exactly once before the process exits.
 *
 * @param createServer - Factory that returns a new MCP server per invocation.
 * @param logger - Optional logging port; defaults to the framework stderr logger.
 * @returns The stdio server handle, so callers can close the connection.
 */
export function startStdio(
  createServer: McpServerFactory,
  logger: IStdioLogger = defaultStdioLogger,
): StdioServerHandle {
  const handle = serveStdio(createServer, {
    onerror: (error) => {
      logger.error({ err: error }, "stdio transport error");
    },
  });

  let isShuttingDown = false;

  /**
   * Closes the stdio handle once, then exits after the close settles.
   *
   * @param signal - The delivered process signal.
   */
  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "stdio shutting down");

    void handle
      .close()
      .catch((error: unknown) => {
        logger.error({ err: error }, "stdio shutdown failed");
        process.exitCode = 1;
      })
      .finally(() => {
        process.exit();
      });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  logger.info({}, "stdio transport started");

  return handle;
}
