import type { McpServer } from "@modelcontextprotocol/server";

import { mapResourceResult, mapToolError, mapToolResult } from "./map-results";
import type { IResolvedCapabilities, IResolvedResource, IResolvedTool } from "./types";

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
 * Registers one resolved resource with the SDK.
 *
 * The decorator-owned URI and listing MIME hint are passed to the SDK. The
 * wrapper forwards the URI as a string and the request-extra argument
 * unchanged, calls the resolved handler without parsing, and maps the domain
 * value to contents. Serialization errors are not caught here so the SDK
 * returns a protocol failure.
 *
 * @param server - Server receiving the resource registration.
 * @param resolved - Resolved resource metadata and instance.
 */
function registerResource(server: McpServer, resolved: IResolvedResource): void {
  const { metadata, instance } = resolved;

  server.registerResource(
    metadata.name,
    metadata.uri,
    {
      description: metadata.description,
      mimeType: metadata.mimeType,
    },
    async (uri, extra) => {
      const value = await instance.handler(uri.href, extra);

      return mapResourceResult(uri.href, value);
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

  for (const resource of capabilities.resources) {
    registerResource(server, resource);
  }
}
