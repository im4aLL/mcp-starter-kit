import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../utils/logger";
import {
  isCallToolResult,
  isJsonValue,
  isReadResourceResult,
  mapResourceResult,
  mapToolError,
  mapToolResult,
  ResourceSerializationError,
} from "./map-results";
import type { JsonObject, ResourceHandlerResultType } from "./types";

/**
 * Invokes {@link mapResourceResult} with a value outside the declared contract.
 *
 * Negative mapper tests intentionally pass values the type system excludes; the
 * runtime guard is what must reject them.
 *
 * @param value - Unsupported handler value.
 * @returns The mapped result, or throws from the mapper.
 */
function mapUnsupportedResource(value: unknown): ReadResourceResult {
  return mapResourceResult("project://info", value as ResourceHandlerResultType);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isCallToolResult", () => {
  it("accepts a result with a content array", () => {
    expect(isCallToolResult({ content: [{ type: "text", text: "hi" }] })).toBe(true);
  });

  it("rejects domain objects and primitives", () => {
    expect(isCallToolResult({ result: 3 })).toBe(false);
    expect(isCallToolResult(3)).toBe(false);
    expect(isCallToolResult(null)).toBe(false);
  });
});

describe("mapToolResult", () => {
  it("wraps domain output as JSON text plus matching structured content", () => {
    const result = mapToolResult({ result: 3 });

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ result: 3 }) }],
      structuredContent: { result: 3 },
    });
  });

  it("passes an already-built wire result through unchanged", () => {
    const wireResult: CallToolResult = {
      content: [{ type: "text", text: "custom" }],
      structuredContent: { anything: true },
      isError: false,
    };

    expect(mapToolResult(wireResult)).toBe(wireResult);
  });
});

describe("mapToolError", () => {
  it("maps a thrown error and logs it through the pino err key", () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const error = new Error("boom");

    const result = mapToolError(error);

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "boom" }],
    });
    expect(errorSpy).toHaveBeenCalledWith({ err: error }, "tool handler failed");
  });

  it("never writes tool errors to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    mapToolError(new Error("stderr only"));

    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});

describe("isJsonValue", () => {
  it("accepts strings, booleans, finite numbers, and null", () => {
    expect(isJsonValue("text")).toBe(true);
    expect(isJsonValue(true)).toBe(true);
    expect(isJsonValue(3.5)).toBe(true);
    expect(isJsonValue(null)).toBe(true);
  });

  it("accepts nested plain objects and arrays", () => {
    expect(isJsonValue({ a: [1, "two", { b: null }] })).toBe(true);
    expect(isJsonValue(Object.create(null))).toBe(true);
  });

  it("rejects undefined, functions, symbols, and bigint", () => {
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(() => undefined)).toBe(false);
    expect(isJsonValue(Symbol("s"))).toBe(false);
    expect(isJsonValue(1n)).toBe(false);
  });

  it("rejects nonfinite numbers", () => {
    expect(isJsonValue(Number.NaN)).toBe(false);
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isJsonValue(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it("rejects non-plain objects such as Date, Map, and Set", () => {
    expect(isJsonValue(new Date())).toBe(false);
    expect(isJsonValue(new Map())).toBe(false);
    expect(isJsonValue(new Set())).toBe(false);
  });

  it("rejects circular references", () => {
    const circular = {} as JsonObject & { self?: JsonObject };
    circular.self = circular;

    expect(isJsonValue(circular)).toBe(false);
  });
});

describe("isReadResourceResult", () => {
  it("accepts a result with a contents array", () => {
    expect(isReadResourceResult({ contents: [{ uri: "project://info", text: "hi" }] })).toBe(true);
    expect(isReadResourceResult({ contents: [] })).toBe(true);
  });

  it("rejects domain values and primitives", () => {
    expect(isReadResourceResult({ result: 3 })).toBe(false);
    expect(isReadResourceResult("text")).toBe(false);
    expect(isReadResourceResult(null)).toBe(false);
  });
});

describe("mapResourceResult", () => {
  it("maps a string to unquoted text/plain", () => {
    const result = mapResourceResult("project://info", "A class-based MCP server starter.");

    expect(result).toEqual({
      contents: [{ uri: "project://info", mimeType: "text/plain", text: "A class-based MCP server starter." }],
    });
  });

  it("maps an object to application/json", () => {
    const value = { name: "starter", tags: ["mcp"] };

    expect(mapResourceResult("project://info", value)).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: JSON.stringify(value) }],
    });
  });

  it("maps an array to application/json", () => {
    const value = [1, "two", false];

    expect(mapResourceResult("project://info", value)).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: JSON.stringify(value) }],
    });
  });

  it("maps a finite number to application/json", () => {
    expect(mapResourceResult("project://info", 3)).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: "3" }],
    });
  });

  it("maps a boolean to application/json", () => {
    expect(mapResourceResult("project://info", true)).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: "true" }],
    });
  });

  it("maps null to application/json", () => {
    expect(mapResourceResult("project://info", null)).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: "null" }],
    });
  });

  it("returns prebuilt wire contents unchanged before JSON-value detection", () => {
    const wireResult = { contents: [{ uri: "project://info", mimeType: "text/plain", text: "custom" }] };

    expect(mapResourceResult("project://info", wireResult)).toBe(wireResult);
  });

  it("rejects undefined without emitting empty text", () => {
    expect(() => mapUnsupportedResource(undefined)).toThrow(ResourceSerializationError);
  });

  it("rejects a circular object", () => {
    const circular = {} as JsonObject & { self?: JsonObject };
    circular.self = circular;

    expect(() => mapResourceResult("project://info", circular)).toThrow(ResourceSerializationError);
  });

  it("rejects Date", () => {
    expect(() => mapUnsupportedResource(new Date())).toThrow(ResourceSerializationError);
  });

  it("rejects NaN", () => {
    expect(() => mapUnsupportedResource(Number.NaN)).toThrow(ResourceSerializationError);
  });

  it("logs resource serialization failures through the pino err key", () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);

    expect(() => mapUnsupportedResource(undefined)).toThrow(ResourceSerializationError);
    expect(errorSpy).toHaveBeenCalledWith(
      { err: expect.any(ResourceSerializationError) },
      "resource serialization failed",
    );
  });

  it("never writes resource serialization failures to stdout", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    expect(() => mapUnsupportedResource(undefined)).toThrow(ResourceSerializationError);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("rejects JSON.stringify throwing", () => {
    const originalStringify = JSON.stringify;
    const value = { ok: true };
    const stringifySpy = vi.spyOn(JSON, "stringify").mockImplementation((input: unknown) => {
      if (input === value) {
        throw new TypeError("cannot stringify");
      }

      return originalStringify(input);
    });

    expect(() => mapResourceResult("project://info", value)).toThrow(ResourceSerializationError);
    expect(stringifySpy).toHaveBeenCalled();
  });

  it("rejects JSON.stringify returning no text", () => {
    const originalStringify = JSON.stringify;
    const value = { ok: true };
    vi.spyOn(JSON, "stringify").mockImplementation((input: unknown) => {
      if (input === value) {
        return undefined as unknown as string;
      }

      return originalStringify(input);
    });

    expect(() => mapResourceResult("project://info", value)).toThrow(ResourceSerializationError);
  });
});
