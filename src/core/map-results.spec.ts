import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../utils/logger";
import { isCallToolResult, mapToolError, mapToolResult } from "./map-results";

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
