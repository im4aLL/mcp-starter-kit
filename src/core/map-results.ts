import type { CallToolResult } from "@modelcontextprotocol/server";

import { logger } from "../utils/logger";
import type { JsonObject, ToolHandlerResultType } from "./types";

/**
 * Determines whether a handler value is already an MCP wire result.
 *
 * A `CallToolResult` carries a `content` array of content blocks. Domain tool
 * output is a JSON object, so a structured object with a `content` array is
 * treated as wire pass-through.
 *
 * @param value - Handler value to inspect.
 * @returns Whether the value already matches the `CallToolResult` shape.
 */
export function isCallToolResult(value: unknown): value is CallToolResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const content = (value as { readonly content?: unknown }).content;

  return Array.isArray(content);
}

/**
 * Maps a domain tool output to MCP content and structured output.
 *
 * Wire results pass through unchanged. Domain output becomes one JSON text
 * block plus the same object as `structuredContent`, so the two
 * representations agree. Core never parses the output schema; the SDK owns
 * schema application.
 *
 * @param output - Domain tool output or an already-built `CallToolResult`.
 * @returns An MCP `CallToolResult`.
 */
export function mapToolResult(output: ToolHandlerResultType<JsonObject>): CallToolResult {
  if (isCallToolResult(output)) {
    return output;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output,
  };
}

/**
 * Maps a thrown tool error to an MCP tool error result.
 *
 * Logs at the boundary through pino's `err` key so the default serializer
 * keeps the error type, message, and stack. The logger writes to stderr, never
 * stdout.
 *
 * @param error - Value thrown by a tool handler.
 * @returns An MCP error `CallToolResult`.
 */
export function mapToolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  logger.error({ err: error }, "tool handler failed");

  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
