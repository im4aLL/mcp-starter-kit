import {
  type CallToolResult,
  InMemoryTransport,
  type JSONRPCMessage,
  type McpServer,
} from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import { getCapabilityTypes } from "../capabilities/capabilities";
import { serverConfig } from "../config";
import { providers } from "../providers";
import { AddTool } from "../tools/add-tool/add-tool";
import { AddToolInputSchema, AddToolOutputSchema } from "../tools/add-tool/add-tool.schemas";
import { createAppContainer } from "./container";
import { createServer } from "./create-server";
import { getToolMetadata } from "./decorators";
import { registerCapabilities } from "./register-capabilities";
import { resolveCapabilities } from "./resolve-capabilities";
import type { IMcpToolHandler, IResolvedCapabilities, IResolvedTool, IToolMetadata } from "./types";

// Registration captured from a minimal server stand-in.
interface ICapturedRegistration {
  readonly name: string;
  readonly config: {
    readonly description?: string;
    readonly inputSchema?: unknown;
    readonly outputSchema?: unknown;
  };
  readonly callback: (args: unknown, extra: unknown) => Promise<CallToolResult>;
}

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
 * Reads the decorator-owned AddTool metadata, failing loudly when absent.
 *
 * @returns The AddTool metadata.
 */
function requireAddToolMetadata(): IToolMetadata {
  const metadata = getToolMetadata(AddTool);

  if (metadata === undefined) {
    throw new Error("AddTool metadata was not found.");
  }

  return metadata;
}

/**
 * Builds a resolved tool record around a spy handler.
 *
 * @param handler - Handler implementation to wrap.
 * @returns A resolved tool record with AddTool metadata.
 */
function createResolvedTool(handler: IMcpToolHandler["handler"]): IResolvedTool {
  return { metadata: requireAddToolMetadata(), instance: { handler } };
}

/**
 * Creates a minimal `McpServer` stand-in that records tool registrations.
 *
 * @returns The stand-in server and its captured registrations.
 */
function createCapturingServer(): { server: McpServer; registrations: ICapturedRegistration[] } {
  const registrations: ICapturedRegistration[] = [];

  const server = {
    /**
     * Records a registration instead of hitting the SDK.
     *
     * @param name - Registered tool name.
     * @param config - Registered tool configuration.
     * @param callback - Registered tool callback.
     * @returns Nothing.
     */
    registerTool(
      name: string,
      config: ICapturedRegistration["config"],
      callback: ICapturedRegistration["callback"],
    ): undefined {
      registrations.push({ name, config, callback });
      return undefined;
    },
  } as unknown as McpServer;

  return { server, registrations };
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

describe("registerCapabilities", () => {
  it("registers the decorator-owned name, description, and schemas", () => {
    const { server, registrations } = createCapturingServer();

    registerCapabilities(server, { tools: [createResolvedTool(vi.fn())] });

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.name).toBe("add");
    expect(registrations[0]?.config.description).toBe("Adds two numbers together.");
    expect(registrations[0]?.config.inputSchema).toBe(AddToolInputSchema);
    expect(registrations[0]?.config.outputSchema).toBe(AddToolOutputSchema);
  });

  it("maps a domain result and forwards arguments plus extra unchanged", async () => {
    const handler = vi.fn().mockResolvedValue({ result: 3 });
    const { server, registrations } = createCapturingServer();
    const extra = { forwarded: true };

    registerCapabilities(server, { tools: [createResolvedTool(handler)] });

    const result = await registrations[0]?.callback({ a: 1, b: 2 }, extra);

    expect(handler).toHaveBeenCalledWith({ a: 1, b: 2 }, extra);
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ result: 3 }) }],
      structuredContent: { result: 3 },
    });
  });

  it("maps a thrown handler error to an MCP tool error result", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const { server, registrations } = createCapturingServer();

    registerCapabilities(server, { tools: [createResolvedTool(handler)] });

    const result = await registrations[0]?.callback({ a: 1, b: 2 }, undefined);

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "boom" }],
    });
  });

  it("registers nothing when there are no tool capabilities", () => {
    const { server, registrations } = createCapturingServer();
    const empty: IResolvedCapabilities = { tools: [] };

    registerCapabilities(server, empty);

    expect(registrations).toHaveLength(0);
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
