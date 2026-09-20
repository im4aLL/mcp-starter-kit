import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServer } from "./create-server.ts";

const { serverInfoSpy } = vi.hoisted(() => ({ serverInfoSpy: vi.fn() }));

/**
 * Wraps the SDK `McpServer` so the spec can observe the identity that the
 * factory forwards to the constructor, then builds the real server unchanged.
 *
 * @param importOriginal - Loads the real `@modelcontextprotocol/server` module.
 * @returns The real module with `McpServer` replaced by {@link ObservedMcpServer}.
 */
vi.mock("@modelcontextprotocol/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modelcontextprotocol/server")>();

  class ObservedMcpServer extends actual.McpServer {
    /**
     * Records the advertised identity before delegating to the real constructor.
     *
     * @param serverInfo - The identity advertised to MCP clients.
     * @param options - Optional protocol options forwarded to the SDK.
     */
    constructor(
      serverInfo: ConstructorParameters<typeof actual.McpServer>[0],
      options?: ConstructorParameters<typeof actual.McpServer>[1],
    ) {
      super(serverInfo, options);
      serverInfoSpy(serverInfo);
    }
  }

  return { ...actual, McpServer: ObservedMcpServer };
});

describe("createServer", () => {
  beforeEach(() => {
    serverInfoSpy.mockClear();
  });

  it("advertises the configured name and version to the McpServer", () => {
    const server = createServer();

    expect(server).toBeDefined();
    expect(serverInfoSpy).toHaveBeenCalledWith({ name: "mcp-framework", version: "0.1.0" });
  });

  it("returns a new server instance on every call", () => {
    const first = createServer();
    const second = createServer();

    expect(first).not.toBe(second);
  });

  it("exposes the underlying protocol server for later registration", () => {
    const server = createServer();

    expect(server.server).toBeDefined();
    expect(server.server.getClientCapabilities()).toBeUndefined();
  });
});
