import type { McpServer } from "@modelcontextprotocol/server";

import { mapToolError, mapToolResult } from "./map-results";
import type { IResolvedCapabilities, IResolvedTool } from "./types";

/**
 * Registers one resolved tool with the SDK.
 *
 * Decorator-owned schemas are passed to the SDK, which owns input and output
 * validation. The wrapper forwards the request-extra argument unchanged and
 * maps domain output or thrown errors without parsing either schema in core.
 *
 * @param server - Server receiving the tool registration.
 * @param resolved - Resolved tool metadata and instance.
 */
function registerTool(server: McpServer, resolved: IResolvedTool): void {
  const { metadata, instance } = resolved;

  server.registerTool(
    metadata.name,
    {
      description: metadata.description,
      inputSchema: metadata.inputSchema,
      outputSchema: metadata.outputSchema,
    },
    async (args, extra) => {
      try {
        const output = await instance.handler(args, extra);

        return mapToolResult(output);
      } catch (error) {
        return mapToolError(error);
      }
    },
  );
}

/**
 * Registers resolved runtime capabilities with a server.
 *
 * @param server - Server receiving the registrations.
 * @param capabilities - Resolved runtime capabilities.
 */
export function registerCapabilities(server: McpServer, capabilities: IResolvedCapabilities): void {
  for (const tool of capabilities.tools) {
    registerTool(server, tool);
  }
}
