import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/server";

import { logger } from "../utils/logger";
import type { JsonObject, JsonValue, ResourceHandlerResultType, ToolHandlerResultType } from "./types";

/**
 * Error thrown when a domain resource value cannot be serialized to MCP contents.
 *
 * Resources have no tool-style `isError`, so callers must let this propagate
 * and let the SDK turn it into a protocol failure rather than fabricating empty
 * contents.
 */
export class ResourceSerializationError extends Error {
  /**
   * Creates a resource serialization error.
   *
   * @param message - Human-readable failure reason.
   * @param options - Optional error options carrying the underlying cause.
   */
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ResourceSerializationError";
  }
}

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
 * Determines whether a handler value is already an MCP resource wire result.
 *
 * A resource wire result carries a `contents` array. The check runs before
 * JSON-value detection because a contents object is itself a JSON object.
 *
 * @param value - Handler value to inspect.
 * @returns Whether the value already matches the `ReadResourceResult` shape.
 */
export function isReadResourceResult(value: unknown): value is ReadResourceResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const contents = (value as { readonly contents?: unknown }).contents;

  return Array.isArray(contents);
}

/**
 * Determines whether a value can be serialized as JSON without semantic loss.
 *
 * Strings, booleans, finite numbers, `null`, arrays of JSON values, and plain
 * objects of JSON values qualify. Functions, symbols, `bigint`, nonfinite
 * numbers, class instances, `Date`/`Map`/`Set`, and circular references do not.
 *
 * @param value - Value to inspect.
 * @param ancestors - Objects in the active traversal path.
 * @returns Whether the value satisfies the JSON value contract.
 */
export function isJsonValue(value: unknown, ancestors: WeakSet<object> = new WeakSet()): value is JsonValue {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;

  if (valueType === "string" || valueType === "boolean") {
    return true;
  }

  if (valueType === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "object") {
    return false;
  }

  if (ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.every((item) => isJsonValue(item, ancestors));
    }

    const prototype = Object.getPrototypeOf(value) as object | null;

    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }

    return Object.values(value).every((item) => isJsonValue(item, ancestors));
  } finally {
    ancestors.delete(value);
  }
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

/**
 * Logs and throws a resource serialization error.
 *
 * The error is logged through pino's `err` key so the default serializer keeps
 * its type, message, and stack. The caller rethrows so the SDK returns a
 * protocol failure rather than fake contents.
 *
 * @param message - Human-readable failure reason.
 * @param cause - Underlying error when serialization threw.
 * @returns Never; always throws.
 * @throws ResourceSerializationError always.
 */
function failResourceSerialization(message: string, cause?: unknown): never {
  const error = new ResourceSerializationError(message, cause === undefined ? undefined : { cause });

  logger.error({ err: error }, "resource serialization failed");

  throw error;
}

/**
 * Serializes a JSON value for a resource body.
 *
 * @param uri - Resource URI used in failure messages.
 * @param value - JSON value to serialize.
 * @returns The serialized JSON text.
 * @throws ResourceSerializationError when `JSON.stringify` throws or produces no text.
 */
function serializeJsonResource(uri: string, value: JsonValue): string {
  let text: string | undefined;

  try {
    text = JSON.stringify(value);
  } catch (error) {
    failResourceSerialization(`Resource "${uri}" failed JSON serialization.`, error);
  }

  if (typeof text !== "string") {
    failResourceSerialization(`Resource "${uri}" serialized to no text.`);
  }

  return text;
}

/**
 * Maps a domain resource value to MCP resource contents.
 *
 * Check order is wire `{ contents }` first, then strings, then other JSON
 * values. Wire results pass through unchanged. Strings become `text/plain`
 * without JSON quoting. Other JSON values become `application/json` with
 * `JSON.stringify`. Unsupported or unserializable values throw
 * {@link ResourceSerializationError}; the mapper never emits empty text.
 *
 * @param uri - Resource URI requested by the MCP client.
 * @param value - Domain resource value or an already-built wire result.
 * @returns An MCP `ReadResourceResult`.
 * @throws ResourceSerializationError when the value is not a supported resource value.
 */
export function mapResourceResult(uri: string, value: ResourceHandlerResultType): ReadResourceResult {
  if (isReadResourceResult(value)) {
    return value;
  }

  if (typeof value === "string") {
    return {
      contents: [{ uri, mimeType: "text/plain", text: value }],
    };
  }

  if (!isJsonValue(value)) {
    failResourceSerialization(`Resource "${uri}" returned a value that is not a JSON value.`);
  }

  return {
    contents: [{ uri, mimeType: "application/json", text: serializeJsonResource(uri, value) }],
  };
}
