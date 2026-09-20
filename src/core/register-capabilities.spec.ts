import type { CallToolResult, McpServer, ReadResourceResult } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

import {
  FixtureAddTool,
  FixtureAddToolInputSchema,
  FixtureAddToolOutputSchema,
  FixtureProjectInfoResource,
} from "./core-test-fixtures";
import { getResourceMetadata, getToolMetadata } from "./decorators";
import { ResourceSerializationError } from "./map-results";
import { registerCapabilities } from "./register-capabilities";
import type {
  IMcpResourceHandler,
  IMcpToolHandler,
  IResolvedCapabilities,
  IResolvedResource,
  IResolvedTool,
  IResourceMetadata,
  IToolMetadata,
} from "./types";

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

// Resource registration captured from a minimal server stand-in.
interface ICapturedResourceRegistration {
  readonly name: string;
  readonly uri: string;
  readonly config: {
    readonly description?: string;
    readonly mimeType?: string;
  };
  readonly callback: (uri: URL, extra: unknown) => Promise<ReadResourceResult>;
}

/**
 * Reads the decorator-owned fixture tool metadata, failing loudly when absent.
 *
 * @returns The fixture tool metadata.
 */
function requireFixtureToolMetadata(): IToolMetadata {
  const metadata = getToolMetadata(FixtureAddTool);

  if (metadata === undefined) {
    throw new Error("FixtureAddTool metadata was not found.");
  }

  return metadata;
}

/**
 * Reads the decorator-owned fixture resource metadata, failing loudly when absent.
 *
 * @returns The fixture resource metadata.
 */
function requireFixtureResourceMetadata(): IResourceMetadata {
  const metadata = getResourceMetadata(FixtureProjectInfoResource);

  if (metadata === undefined) {
    throw new Error("FixtureProjectInfoResource metadata was not found.");
  }

  return metadata;
}

/**
 * Builds a resolved tool record around a spy handler.
 *
 * @param handler - Handler implementation to wrap.
 * @returns A resolved tool record with fixture tool metadata.
 */
function createResolvedTool(handler: IMcpToolHandler["handler"]): IResolvedTool {
  return { metadata: requireFixtureToolMetadata(), instance: { handler } };
}

/**
 * Builds a resolved resource record around a spy handler.
 *
 * @param handler - Handler implementation to wrap.
 * @returns A resolved resource record with fixture resource metadata.
 */
function createResolvedResource(handler: IMcpResourceHandler["handler"]): IResolvedResource {
  return { metadata: requireFixtureResourceMetadata(), instance: { handler } };
}

/**
 * Creates a minimal `McpServer` stand-in that records capability registrations.
 *
 * @returns The stand-in server plus its captured tool and resource registrations.
 */
function createCapturingServer(): {
  server: McpServer;
  registrations: ICapturedRegistration[];
  resourceRegistrations: ICapturedResourceRegistration[];
} {
  const registrations: ICapturedRegistration[] = [];
  const resourceRegistrations: ICapturedResourceRegistration[] = [];

  const server = {
    /**
     * Records a tool registration instead of hitting the SDK.
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
    /**
     * Records a resource registration instead of hitting the SDK.
     *
     * @param name - Registered resource name.
     * @param uri - Registered resource URI.
     * @param config - Registered resource configuration.
     * @param callback - Registered resource callback.
     * @returns Nothing.
     */
    registerResource(
      name: string,
      uri: string,
      config: ICapturedResourceRegistration["config"],
      callback: ICapturedResourceRegistration["callback"],
    ): undefined {
      resourceRegistrations.push({ name, uri, config, callback });
      return undefined;
    },
  } as unknown as McpServer;

  return { server, registrations, resourceRegistrations };
}

describe("registerCapabilities", () => {
  it("registers the decorator-owned name, description, and schemas", () => {
    const { server, registrations } = createCapturingServer();

    registerCapabilities(server, { tools: [createResolvedTool(vi.fn())], resources: [] });

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.name).toBe("add");
    expect(registrations[0]?.config.description).toBe("Adds two numbers together.");
    expect(registrations[0]?.config.inputSchema).toBe(FixtureAddToolInputSchema);
    expect(registrations[0]?.config.outputSchema).toBe(FixtureAddToolOutputSchema);
  });

  it("maps a domain result and forwards arguments plus extra unchanged", async () => {
    const handler = vi.fn().mockResolvedValue({ result: 3 });
    const { server, registrations } = createCapturingServer();
    const extra = { forwarded: true };

    registerCapabilities(server, { tools: [createResolvedTool(handler)], resources: [] });

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

    registerCapabilities(server, { tools: [createResolvedTool(handler)], resources: [] });

    const result = await registrations[0]?.callback({ a: 1, b: 2 }, undefined);

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "boom" }],
    });
  });

  it("registers nothing when there are no capabilities", () => {
    const { server, registrations, resourceRegistrations } = createCapturingServer();
    const empty: IResolvedCapabilities = { tools: [], resources: [] };

    registerCapabilities(server, empty);

    expect(registrations).toHaveLength(0);
    expect(resourceRegistrations).toHaveLength(0);
  });

  it("registers the decorator-owned resource name, URI, and MIME hint", () => {
    const { server, resourceRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], resources: [createResolvedResource(vi.fn())] });

    expect(resourceRegistrations).toHaveLength(1);
    expect(resourceRegistrations[0]?.name).toBe("Project information");
    expect(resourceRegistrations[0]?.uri).toBe("project://info");
    expect(resourceRegistrations[0]?.config.description).toBe("Describes the MCP starter project.");
    expect(resourceRegistrations[0]?.config.mimeType).toBe("text/plain");
  });

  it("maps a string resource and forwards the URI plus extra unchanged", async () => {
    const handler = vi.fn().mockResolvedValue("A class-based MCP server starter.");
    const { server, resourceRegistrations } = createCapturingServer();
    const extra = { forwarded: true };

    registerCapabilities(server, { tools: [], resources: [createResolvedResource(handler)] });

    const result = await resourceRegistrations[0]?.callback(new URL("project://info"), extra);

    expect(handler).toHaveBeenCalledWith("project://info", extra);
    expect(result).toEqual({
      contents: [{ uri: "project://info", mimeType: "text/plain", text: "A class-based MCP server starter." }],
    });
  });

  it("maps a JSON resource value to application/json", async () => {
    const handler = vi.fn().mockResolvedValue({ name: "starter" });
    const { server, resourceRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], resources: [createResolvedResource(handler)] });

    const result = await resourceRegistrations[0]?.callback(new URL("project://info"), undefined);

    expect(result).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: JSON.stringify({ name: "starter" }) }],
    });
  });

  it("propagates a resource serialization failure instead of emitting fake contents", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { server, resourceRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], resources: [createResolvedResource(handler)] });

    await expect(resourceRegistrations[0]?.callback(new URL("project://info"), undefined)).rejects.toBeInstanceOf(
      ResourceSerializationError,
    );
  });
});
