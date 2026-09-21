import type { CallToolResult, GetPromptResult, ReadResourceResult } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../utils/logger";
import {
  isCallToolResult,
  isGetPromptResult,
  isJsonValue,
  isReadResourceResult,
  mapPromptResult,
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

  it("keeps domain text and structured content on the same output object", () => {
    const output = { result: 3 };
    const result = mapToolResult(output);

    expect(result.structuredContent).toBe(output);
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify(output) }]);
  });

  it("passes an already-built wire result through unchanged", () => {
    const wireResult: CallToolResult = {
      content: [{ type: "text", text: "custom" }],
      structuredContent: { anything: true },
      isError: false,
    };

    expect(mapToolResult(wireResult)).toBe(wireResult);
  });

  it("treats a domain object with a content array as wire pass-through (documented limitation)", () => {
    const output = { content: [{ type: "text", text: "domain-shaped" }], other: 1 };

    const result = mapToolResult(output);

    expect(result).toBe(output);
    expect(result.structuredContent).toBeUndefined();
  });

  it("passes a mixed-content wire result through by identity with its extra fields", () => {
    const wireResult: CallToolResult = {
      content: [
        { type: "text", text: "first" },
        { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
        {
          type: "resource",
          resource: { uri: "project://info", mimeType: "text/plain", text: "embedded" },
        },
      ],
      structuredContent: { anything: true },
      isError: false,
      _meta: { fixture: "mixed" },
    };

    const result = mapToolResult(wireResult);

    expect(result).toBe(wireResult);
    expect(result.content).toHaveLength(3);
    expect(result.isError).toBe(false);
    expect(result._meta).toEqual({ fixture: "mixed" });
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

  it("keeps stack details out of client-visible error text", () => {
    const error = new Error("safe message");
    const result = mapToolError(error);

    expect(result.content).toEqual([{ type: "text", text: "safe message" }]);
    expect(result.content[0]).not.toEqual(
      expect.objectContaining({ text: expect.stringContaining(error.stack ?? "") }),
    );
    expect(result.content[0]).not.toEqual(expect.objectContaining({ text: expect.stringContaining("at ") }));
  });

  it("maps a thrown non-Error value without leaking its contents", () => {
    const secret = { stack: "secret detail" };

    expect(mapToolError("plain failure").content).toEqual([{ type: "text", text: "plain failure" }]);
    expect(mapToolError(secret).content).toEqual([{ type: "text", text: "[object Object]" }]);
    expect(mapToolError(secret).content[0]).not.toEqual(
      expect.objectContaining({ text: expect.stringContaining("secret detail") }),
    );
  });
});

describe("isGetPromptResult", () => {
  it("accepts a result with a messages array", () => {
    expect(isGetPromptResult({ messages: [{ role: "user", content: { type: "text", text: "hi" } }] })).toBe(true);
    expect(isGetPromptResult({ messages: [] })).toBe(true);
  });

  it("rejects domain strings and primitives", () => {
    expect(isGetPromptResult("text")).toBe(false);
    expect(isGetPromptResult(3)).toBe(false);
    expect(isGetPromptResult(null)).toBe(false);
  });
});

describe("mapPromptResult", () => {
  it("wraps a string as one text message with an explicit role", () => {
    const result = mapPromptResult("Assist with this task.", "assistant");

    expect(result).toEqual({
      messages: [{ role: "assistant", content: { type: "text", text: "Assist with this task." } }],
    });
  });

  it("defaults the string shortcut role to user", () => {
    const result = mapPromptResult("Review this.");

    expect(result).toEqual({
      messages: [{ role: "user", content: { type: "text", text: "Review this." } }],
    });
  });

  it("passes an already-built mixed-role result through unchanged", () => {
    const wireResult: GetPromptResult = {
      messages: [
        { role: "user", content: { type: "text", text: "question" } },
        { role: "assistant", content: { type: "text", text: "answer" } },
      ],
    };

    expect(mapPromptResult(wireResult)).toBe(wireResult);
  });

  it("passes mixed message content types and extra fields through by identity", () => {
    const wireResult: GetPromptResult = {
      description: "Mixed fixture.",
      messages: [
        { role: "user", content: { type: "text", text: "question" } },
        { role: "assistant", content: { type: "image", data: "aGVsbG8=", mimeType: "image/png" } },
        {
          role: "user",
          content: {
            type: "resource",
            resource: { uri: "project://info", mimeType: "text/plain", text: "embedded" },
          },
        },
      ],
      _meta: { fixture: "mixed" },
    };

    const result = mapPromptResult(wireResult, "assistant");

    expect(result).toBe(wireResult);
    expect(result.messages).toHaveLength(3);
    expect(result.description).toBe("Mixed fixture.");
    expect(result._meta).toEqual({ fixture: "mixed" });
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

  it("rejects Buffer and class instances", () => {
    /**
     * Minimal class instance used to prove non-plain prototypes are rejected.
     */
    class Widget {
      public readonly value = 1;
    }

    expect(isJsonValue(Buffer.from("bytes"))).toBe(false);
    expect(isJsonValue(new Widget())).toBe(false);
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

  it("maps a nested object to application/json", () => {
    const value = { name: "starter", nested: { items: [1, "two", { deep: null }] } };

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

  it("returns prebuilt binary contents by identity with their MIME types and extra fields", () => {
    const wireResult: ReadResourceResult = {
      contents: [
        { uri: "project://blob", mimeType: "application/octet-stream", blob: "AAECAwQ=" },
        { uri: "project://blob", mimeType: "text/plain", text: "companion" },
      ],
      _meta: { fixture: "binary" },
    };

    const result = mapResourceResult("project://blob", wireResult);

    expect(result).toBe(wireResult);
    expect(result.contents[0]).toEqual({
      uri: "project://blob",
      mimeType: "application/octet-stream",
      blob: "AAECAwQ=",
    });
    expect(result._meta).toEqual({ fixture: "binary" });
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

  it("rejects functions and symbols", () => {
    expect(() => mapUnsupportedResource(() => undefined)).toThrow(ResourceSerializationError);
    expect(() => mapUnsupportedResource(Symbol("resource"))).toThrow(ResourceSerializationError);
  });

  it("rejects bigint", () => {
    expect(() => mapUnsupportedResource(1n)).toThrow(ResourceSerializationError);
  });

  it("rejects positive and negative infinity", () => {
    expect(() => mapUnsupportedResource(Number.POSITIVE_INFINITY)).toThrow(ResourceSerializationError);
    expect(() => mapUnsupportedResource(Number.NEGATIVE_INFINITY)).toThrow(ResourceSerializationError);
  });

  it("rejects Map and Set", () => {
    expect(() => mapUnsupportedResource(new Map([["a", 1]]))).toThrow(ResourceSerializationError);
    expect(() => mapUnsupportedResource(new Set([1]))).toThrow(ResourceSerializationError);
  });

  it("rejects Buffer and class instances", () => {
    /**
     * Minimal class instance used to prove non-plain prototypes are rejected.
     */
    class Widget {
      public readonly value = 1;
    }

    expect(() => mapUnsupportedResource(Buffer.from("bytes"))).toThrow(ResourceSerializationError);
    expect(() => mapUnsupportedResource(new Widget())).toThrow(ResourceSerializationError);
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
