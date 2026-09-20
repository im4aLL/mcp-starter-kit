import { McpServer } from "@modelcontextprotocol/server";

// Name advertised to MCP clients during initialization.
export const SERVER_NAME = "mcp-framework";

// Version advertised to MCP clients during initialization.
export const SERVER_VERSION = "0.1.0";

/**
 * Creates a transport-independent, empty MCP server.
 *
 * The server advertises only its name and version: tool, resource, and prompt
 * registration belong to later tasks. Each call returns a new instance so the
 * stdio factory can build a fresh server per protocol negotiation.
 *
 * @returns A new {@link McpServer} instance with no registered capabilities.
 */
export function createServer(): McpServer {
  return new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
}
