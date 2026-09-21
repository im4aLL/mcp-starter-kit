import type { CallToolResult, GetPromptResult, ReadResourceResult, ServerContext } from "@modelcontextprotocol/server";

import type { JsonObject, JsonValue } from "./json.types";

// Second handler argument exposed by SDK v2, forwarded unchanged by core.
export type McpRequestExtraType = ServerContext;

// Domain tool results stay JSON-object shaped so structured output is valid.
export type ToolHandlerResultType<TOutput extends JsonObject> = TOutput | CallToolResult;

// Domain resource results are strings or JSON values; SDK wire results pass through.
export type ResourceHandlerResultType<T extends JsonValue = JsonValue> = T | ReadResourceResult;

// Prompt results are a string (wrapped with a role) or an already-built SDK result.
export type PromptHandlerResultType = string | GetPromptResult;

/**
 * Erased runtime contract every tool class implements.
 *
 * The input is `unknown` and the method uses method syntax so specifically
 * typed class handlers remain assignable. Schema-specific checking belongs to
 * the typed `@tool` decorator, not this contract.
 */
export interface IMcpToolHandler {
  handler(
    input: unknown,
    extra?: McpRequestExtraType,
  ): ToolHandlerResultType<JsonObject> | Promise<ToolHandlerResultType<JsonObject>>;
}

/**
 * Erased runtime contract every resource class implements.
 *
 * The URI is a string and the method uses method syntax so specifically typed
 * class handlers remain assignable. The typed `@resource` decorator owns the
 * resource contract check.
 */
export interface IMcpResourceHandler {
  handler(uri: string, extra?: McpRequestExtraType): ResourceHandlerResultType | Promise<ResourceHandlerResultType>;
}

/**
 * Erased runtime contract every prompt class implements.
 *
 * The arguments are `unknown` and the method uses method syntax so specifically
 * typed class handlers remain assignable. Schema-specific checking belongs to
 * the typed `@prompt` decorator, not this contract.
 */
export interface IMcpPromptHandler {
  handler(args: unknown, extra?: McpRequestExtraType): PromptHandlerResultType | Promise<PromptHandlerResultType>;
}
