import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServer } from "./create-server";
import type { IResolvedCapabilities, IServerConfig } from "./types";

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

  /**
   * Subclass that records the advertised identity for the spec.
   */
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

const emptyCapabilities: IResolvedCapabilities = { tools: [], prompts: [], resources: [] };

const testServerConfig: IServerConfig = { name: "test-server", version: "9.9.9" };

describe("createServer", () => {
  beforeEach(() => {
    serverInfoSpy.mockClear();
  });

  it("advertises the caller-supplied name and version to the McpServer", () => {
    const server = createServer(emptyCapabilities, testServerConfig);

    expect(server).toBeDefined();
    expect(serverInfoSpy).toHaveBeenCalledWith({ name: "test-server", version: "9.9.9" });
  });

  it("returns a new server instance on every call", () => {
    const first = createServer(emptyCapabilities, testServerConfig);
    const second = createServer(emptyCapabilities, testServerConfig);

    expect(first).not.toBe(second);
  });

  it("exposes the underlying protocol server for later registration", () => {
    const server = createServer(emptyCapabilities, testServerConfig);

    expect(server.server).toBeDefined();
    expect(server.server.getClientCapabilities()).toBeUndefined();
  });
});
