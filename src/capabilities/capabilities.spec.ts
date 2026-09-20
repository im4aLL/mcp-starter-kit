import {
  type CallToolResult,
  InMemoryTransport,
  type JSONRPCMessage,
  type McpServer,
  type ReadResourceResult,
} from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { serverConfig } from "../config";
import { createAppContainer } from "../core/container";
import { createServer } from "../core/create-server";
import { getResourceMetadata } from "../core/decorators";
import { ResourceSerializationError } from "../core/map-results";
import { resolveCapabilities } from "../core/resolve-capabilities";
import type { IMcpResourceHandler, IResolvedCapabilities, IResolvedResource } from "../core/types";
import { providers } from "../providers";
import { ProjectInfoResource } from "../resources/project-info/project-info";
import { CalculatorService } from "../services/calculator-service";
import { AddTool } from "../tools/add-tool/add-tool";
import { logger } from "../utils/logger";
import { getCapabilityTypes } from "./capabilities";

afterEach(() => {
  vi.restoreAllMocks();
});

// Minimal JSON-RPC response shape used by the in-memory client harness.
interface IJsonRpcResponse {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

// In-memory JSON-RPC client returned by {@link connectTestClient}.
interface ITestClient {
  request(id: number, method: string, params?: unknown): Promise<IJsonRpcResponse>;
  notify(method: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Connects an in-memory JSON-RPC client to a server.
 *
 * @param server - Server to connect.
 * @returns A small request/notify/close client.
 */
async function connectTestClient(server: McpServer): Promise<ITestClient> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (response: IJsonRpcResponse) => void>();

  clientTransport.onmessage = (message) => {
    const response = message as IJsonRpcResponse;

    if (typeof response.id === "number") {
      pending.get(response.id)?.(response);
      pending.delete(response.id);
    }
  };

  await server.connect(serverTransport);
  await clientTransport.start();

  /**
   * Sends one raw JSON-RPC message.
   *
   * @param message - Message to send.
   * @returns A promise that resolves once the transport accepts the message.
   */
  function send(message: Record<string, unknown>): Promise<void> {
    return clientTransport.send(message as JSONRPCMessage);
  }

  return {
    request: (id, method, params) => {
      const response = new Promise<IJsonRpcResponse>((resolve) => pending.set(id, resolve));

      void send({ jsonrpc: "2.0", id, method, params });

      return response;
    },
    notify: (method) => send({ jsonrpc: "2.0", method }),
    close: () => clientTransport.close(),
  };
}

/**
 * Builds a resolved resource record around an unserializable spy handler.
 *
 * @param handler - Handler implementation to wrap.
 * @returns A resolved resource record with the application resource metadata.
 */
function createUnserializableResolvedResource(handler: IMcpResourceHandler["handler"]): IResolvedResource {
  const metadata = getResourceMetadata(ProjectInfoResource);

  if (metadata === undefined) {
    throw new Error("ProjectInfoResource metadata was not found.");
  }

  return { metadata, instance: { handler } };
}

describe("application capability composition", () => {
  it("lists CalculatorService as an ordinary service", () => {
    expect(providers.services).toContain(CalculatorService);
  });

  it("includes AddTool and ProjectInfoResource in the capability types", () => {
    const capabilityTypes = getCapabilityTypes();

    expect(capabilityTypes.tools).toContain(AddTool);
    expect(capabilityTypes.resources).toContain(ProjectInfoResource);
  });

  it("resolves, invokes the erased handler, and registers AddTool without casts", async () => {
    const capabilityTypes = getCapabilityTypes();
    const container = createAppContainer(capabilityTypes, providers);
    const capabilities = resolveCapabilities(container, capabilityTypes);
    const server = createServer(capabilities, serverConfig);

    const resolved = capabilities.tools[0];
    const output = await resolved?.instance.handler({ a: 1, b: 2 });

    expect(resolved?.instance).toBeInstanceOf(AddTool);
    expect(output).toEqual({ result: 3 });
    expect(server).toBeDefined();
  });

  it("resolves and invokes the erased resource handler without casts", () => {
    const capabilityTypes = getCapabilityTypes();
    const container = createAppContainer(capabilityTypes, providers);
    const capabilities = resolveCapabilities(container, capabilityTypes);
    const resource = capabilities.resources[0];

    expect(resource?.instance).toBeInstanceOf(ProjectInfoResource);
    expect(resource?.instance.handler("project://info")).toBe("A class-based MCP server starter.");
  });
});

describe("SDK input validation", () => {
  it("lists add, returns matching text and structured content, and rejects malformed input before the handler", async () => {
    const capabilityTypes = getCapabilityTypes();
    const container = createAppContainer(capabilityTypes, providers);
    const capabilities = resolveCapabilities(container, capabilityTypes);
    const addTool = capabilities.tools[0];

    if (addTool === undefined) {
      throw new Error("AddTool was not resolved.");
    }

    const handlerSpy = vi.spyOn(addTool.instance, "handler");
    const server = createServer(capabilities, serverConfig);
    const client = await connectTestClient(server);

    try {
      const init = await client.request(1, "initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      expect(init.error).toBeUndefined();

      await client.notify("notifications/initialized");

      const list = await client.request(2, "tools/list", {});
      const listedTools = (list.result as { tools: readonly { name: string }[] }).tools;

      expect(listedTools.map((tool) => tool.name)).toContain("add");

      const call = await client.request(3, "tools/call", { name: "add", arguments: { a: 1, b: 2 } });
      const callResult = call.result as CallToolResult;

      expect(call.error).toBeUndefined();
      expect(callResult.content).toEqual([{ type: "text", text: JSON.stringify({ result: 3 }) }]);
      expect(callResult.structuredContent).toEqual({ result: 3 });

      const invalid = await client.request(4, "tools/call", { name: "add", arguments: { a: "x", b: 2 } });
      const invalidResult = invalid.result as CallToolResult;

      expect(invalid.error).toBeUndefined();
      expect(invalidResult.isError).toBe(true);

      const missingOperand = await client.request(5, "tools/call", { name: "add", arguments: { a: 1 } });
      const missingOperandResult = missingOperand.result as CallToolResult;

      expect(missingOperand.error).toBeUndefined();
      expect(missingOperandResult.isError).toBe(true);
    } finally {
      await client.close();
    }

    // The valid call invoked the handler once; neither malformed call did.
    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });
});

describe("SDK resource validation", () => {
  it("lists project://info with its MIME hint and reads the exact text contents", async () => {
    const capabilityTypes = getCapabilityTypes();
    const container = createAppContainer(capabilityTypes, providers);
    const capabilities = resolveCapabilities(container, capabilityTypes);
    const projectInfo = capabilities.resources[0];

    if (projectInfo === undefined) {
      throw new Error("ProjectInfoResource was not resolved.");
    }

    const handlerSpy = vi.spyOn(projectInfo.instance, "handler");
    const server = createServer(capabilities, serverConfig);
    const client = await connectTestClient(server);

    try {
      const init = await client.request(1, "initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      expect(init.error).toBeUndefined();

      await client.notify("notifications/initialized");

      const list = await client.request(2, "resources/list", {});
      const listedResources = (
        list.result as { resources: readonly { uri: string; name: string; mimeType?: string }[] }
      ).resources;
      const listedProjectInfo = listedResources.find((resource) => resource.uri === "project://info");

      expect(listedProjectInfo?.name).toBe("Project information");
      expect(listedProjectInfo?.mimeType).toBe("text/plain");

      const read = await client.request(3, "resources/read", { uri: "project://info" });
      const readResult = read.result as ReadResourceResult;

      expect(read.error).toBeUndefined();
      expect(readResult.contents).toHaveLength(1);
      expect(readResult.contents[0]).toMatchObject({
        uri: "project://info",
        mimeType: "text/plain",
        text: "A class-based MCP server starter.",
      });
    } finally {
      await client.close();
    }

    expect(handlerSpy).toHaveBeenCalledTimes(1);
  });

  it("fails resources/read at the protocol boundary and logs only to stderr for an unsupported value", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const capabilities: IResolvedCapabilities = {
      tools: [],
      resources: [createUnserializableResolvedResource(handler)],
    };
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const server = createServer(capabilities, serverConfig);
    const client = await connectTestClient(server);

    try {
      const init = await client.request(1, "initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      });
      expect(init.error).toBeUndefined();

      await client.notify("notifications/initialized");

      const read = await client.request(2, "resources/read", { uri: "project://info" });

      expect(read.error).toBeDefined();
      expect(read.result).toBeUndefined();
    } finally {
      await client.close();
    }

    expect(errorSpy).toHaveBeenCalledWith(
      { err: expect.any(ResourceSerializationError) },
      "resource serialization failed",
    );
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
