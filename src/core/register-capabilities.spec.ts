import type { CallToolResult, GetPromptResult, McpServer, ReadResourceResult } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../utils/logger";
import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureAddToolInputSchema,
  FixtureAddToolOutputSchema,
  FixtureCodeReviewPrompt,
  FixtureCodeReviewPromptArgsSchema,
  FixtureProjectInfoResource,
} from "./core-test-fixtures";
import { getPromptMetadata, getResourceMetadata, getToolMetadata } from "./decorators";
import { ResourceSerializationError } from "./map-results";
import { registerCapabilities } from "./register-capabilities";
import { resolveCapabilities } from "./resolve-capabilities";
import {
  FixtureWirePromptResult,
  FixtureWireResourceResult,
  FixtureWireToolResult,
  resultMappingCapabilities,
  resultMappingProviders,
} from "./result-mapping-test-fixtures";
import type {
  IMcpPromptHandler,
  IMcpResourceHandler,
  IMcpToolHandler,
  IPromptMetadata,
  IResolvedCapabilities,
  IResolvedPrompt,
  IResolvedResource,
  IResolvedTool,
  IResourceMetadata,
  IToolMetadata,
  McpRequestExtraType,
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

// Prompt registration captured from a minimal server stand-in.
interface ICapturedPromptRegistration {
  readonly name: string;
  readonly config: {
    readonly description?: string;
    readonly argsSchema?: unknown;
  };
  readonly callback: (args: unknown, extra: unknown) => Promise<GetPromptResult>;
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
 * Reads the decorator-owned fixture prompt metadata, failing loudly when absent.
 *
 * @returns The fixture prompt metadata.
 */
function requireFixturePromptMetadata(): IPromptMetadata {
  const metadata = getPromptMetadata(FixtureCodeReviewPrompt);

  if (metadata === undefined) {
    throw new Error("FixtureCodeReviewPrompt metadata was not found.");
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
 * Builds a resolved prompt record around a spy handler.
 *
 * @param handler - Handler implementation to wrap.
 * @returns A resolved prompt record with fixture prompt metadata.
 */
function createResolvedPrompt(handler: IMcpPromptHandler["handler"]): IResolvedPrompt {
  return { metadata: requireFixturePromptMetadata(), instance: { handler } };
}

/**
 * Creates a request-extra value typed as the verified SDK server context.
 *
 * The value exposes real `mcpReq` members (`signal`, `notify`, `log`, `_meta`)
 * so tests can read them without wrapping and compare reference identity.
 *
 * @returns A typed server context with observable `mcpReq` members.
 */
function createTestExtra(): McpRequestExtraType {
  const controller = new AbortController();

  return {
    mcpReq: {
      id: 1,
      method: "tools/call",
      _meta: {},
      signal: controller.signal,
      notify: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as McpRequestExtraType;
}

/**
 * Creates a minimal `McpServer` stand-in that records capability registrations.
 *
 * @returns The stand-in server plus its captured tool, prompt, and resource registrations.
 */
function createCapturingServer(): {
  server: McpServer;
  registrations: ICapturedRegistration[];
  promptRegistrations: ICapturedPromptRegistration[];
  resourceRegistrations: ICapturedResourceRegistration[];
} {
  const registrations: ICapturedRegistration[] = [];
  const promptRegistrations: ICapturedPromptRegistration[] = [];
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
     * Records a prompt registration instead of hitting the SDK.
     *
     * @param name - Registered prompt name.
     * @param config - Registered prompt configuration.
     * @param callback - Registered prompt callback.
     * @returns Nothing.
     */
    registerPrompt(
      name: string,
      config: ICapturedPromptRegistration["config"],
      callback: ICapturedPromptRegistration["callback"],
    ): undefined {
      promptRegistrations.push({ name, config, callback });
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

  return { server, registrations, promptRegistrations, resourceRegistrations };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerCapabilities", () => {
  it("registers the decorator-owned name, description, and schemas", () => {
    const { server, registrations } = createCapturingServer();

    registerCapabilities(server, { tools: [createResolvedTool(vi.fn())], prompts: [], resources: [] });

    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.name).toBe("add");
    expect(registrations[0]?.config.description).toBe("Adds two numbers together.");
    expect(registrations[0]?.config.inputSchema).toBe(FixtureAddToolInputSchema);
    expect(registrations[0]?.config.outputSchema).toBe(FixtureAddToolOutputSchema);
  });

  it("maps a domain result and forwards arguments plus the exact extra reference", async () => {
    const handler = vi.fn().mockResolvedValue({ result: 3 });
    const { server, registrations } = createCapturingServer();
    const extra = createTestExtra();

    registerCapabilities(server, { tools: [createResolvedTool(handler)], prompts: [], resources: [] });

    const result = await registrations[0]?.callback({ a: 1, b: 2 }, extra);

    expect(handler).toHaveBeenCalledWith({ a: 1, b: 2 }, extra);
    expect(handler.mock.calls[0]?.[1]).toBe(extra);
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ result: 3 }) }],
      structuredContent: { result: 3 },
    });
  });

  it("forwards the original SDK extra to an extra-aware tool while a sample-style handler omits it", async () => {
    const sampleStyle = vi.fn().mockResolvedValue({ result: 1 });
    let passedExtra: McpRequestExtraType | undefined;
    const extraAware: IMcpToolHandler["handler"] = (_input, requestExtra) => {
      passedExtra = requestExtra;
      return { result: 2 };
    };
    const { server, registrations } = createCapturingServer();
    const extra = createTestExtra();

    registerCapabilities(server, {
      tools: [createResolvedTool(sampleStyle), createResolvedTool(extraAware)],
      prompts: [],
      resources: [],
    });

    const sampleResult = await registrations[0]?.callback({ a: 1, b: 2 }, extra);
    const awareResult = await registrations[1]?.callback({ a: 3, b: 4 }, extra);

    expect(sampleStyle).toHaveBeenCalledWith({ a: 1, b: 2 }, extra);
    expect(passedExtra).toBe(extra);
    expect(passedExtra?.mcpReq.signal).toBe(extra.mcpReq.signal);
    expect(passedExtra?.mcpReq.notify).toBe(extra.mcpReq.notify);
    expect(passedExtra?.mcpReq.log).toBe(extra.mcpReq.log);
    expect(passedExtra?.mcpReq._meta).toBe(extra.mcpReq._meta);
    expect(sampleResult).toEqual({
      content: [{ type: "text", text: JSON.stringify({ result: 1 }) }],
      structuredContent: { result: 1 },
    });
    expect(awareResult).toEqual({
      content: [{ type: "text", text: JSON.stringify({ result: 2 }) }],
      structuredContent: { result: 2 },
    });
  });

  it("maps a thrown handler error to an MCP tool error result", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("boom"));
    const { server, registrations } = createCapturingServer();

    registerCapabilities(server, { tools: [createResolvedTool(handler)], prompts: [], resources: [] });

    const result = await registrations[0]?.callback({ a: 1, b: 2 }, undefined);

    expect(result).toEqual({
      isError: true,
      content: [{ type: "text", text: "boom" }],
    });
  });

  it("registers nothing when there are no capabilities", () => {
    const { server, registrations, promptRegistrations, resourceRegistrations } = createCapturingServer();
    const empty: IResolvedCapabilities = { tools: [], prompts: [], resources: [] };

    registerCapabilities(server, empty);

    expect(registrations).toHaveLength(0);
    expect(promptRegistrations).toHaveLength(0);
    expect(resourceRegistrations).toHaveLength(0);
  });

  it("registers the decorator-owned prompt name, description, and argument schema", () => {
    const { server, promptRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], prompts: [createResolvedPrompt(vi.fn())], resources: [] });

    expect(promptRegistrations).toHaveLength(1);
    expect(promptRegistrations[0]?.name).toBe("code_review");
    expect(promptRegistrations[0]?.config.description).toBe("Requests a focused review of the supplied code.");
    expect(promptRegistrations[0]?.config.argsSchema).toBe(FixtureCodeReviewPromptArgsSchema);
  });

  it("maps a string prompt with the decorator role and forwards the exact extra reference", async () => {
    const handler = vi.fn().mockResolvedValue("Review the following code:\n\nconst x = 1;");
    const { server, promptRegistrations } = createCapturingServer();
    const extra = createTestExtra();

    registerCapabilities(server, { tools: [], prompts: [createResolvedPrompt(handler)], resources: [] });

    const result = await promptRegistrations[0]?.callback({ code: "const x = 1;" }, extra);

    expect(handler).toHaveBeenCalledWith({ code: "const x = 1;" }, extra);

    const passedExtra = handler.mock.calls[0]?.[1] as McpRequestExtraType | undefined;

    expect(passedExtra).toBe(extra);
    expect(passedExtra?.mcpReq.signal).toBe(extra.mcpReq.signal);
    expect(passedExtra?.mcpReq.notify).toBe(extra.mcpReq.notify);
    expect(passedExtra?.mcpReq.log).toBe(extra.mcpReq.log);
    expect(passedExtra?.mcpReq._meta).toBe(extra.mcpReq._meta);
    expect(result).toEqual({
      messages: [{ role: "user", content: { type: "text", text: "Review the following code:\n\nconst x = 1;" } }],
    });
  });

  it("passes an already-built mixed-role prompt result through unchanged", async () => {
    const wireResult: GetPromptResult = {
      messages: [
        { role: "user", content: { type: "text", text: "first" } },
        { role: "assistant", content: { type: "text", text: "second" } },
      ],
    };
    const handler = vi.fn().mockResolvedValue(wireResult);
    const { server, promptRegistrations } = createCapturingServer();
    const extra = createTestExtra();

    registerCapabilities(server, { tools: [], prompts: [createResolvedPrompt(handler)], resources: [] });

    const result = await promptRegistrations[0]?.callback({ code: "unused" }, extra);

    expect(handler).toHaveBeenCalledWith({ code: "unused" }, extra);
    expect(handler.mock.calls[0]?.[1]).toBe(extra);
    expect(result).toBe(wireResult);
  });

  it("defaults the string prompt role to user when decorator metadata omits it", async () => {
    const handler = vi.fn().mockResolvedValue("Roleless prompt.");
    const resolved: IResolvedPrompt = {
      metadata: { ...requireFixturePromptMetadata(), role: undefined },
      instance: { handler },
    };
    const { server, promptRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], prompts: [resolved], resources: [] });

    const result = await promptRegistrations[0]?.callback({ code: "unused" }, undefined);

    expect(result).toEqual({
      messages: [{ role: "user", content: { type: "text", text: "Roleless prompt." } }],
    });
  });

  it("propagates a rejecting prompt handler instead of emitting fake messages", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("prompt failure"));
    const { server, promptRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], prompts: [createResolvedPrompt(handler)], resources: [] });

    await expect(promptRegistrations[0]?.callback({ code: "unused" }, undefined)).rejects.toThrow("prompt failure");
    expect(handler).toHaveBeenCalledWith({ code: "unused" }, undefined);
  });

  it("registers the decorator-owned resource name, URI, and MIME hint", () => {
    const { server, resourceRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], prompts: [], resources: [createResolvedResource(vi.fn())] });

    expect(resourceRegistrations).toHaveLength(1);
    expect(resourceRegistrations[0]?.name).toBe("Project information");
    expect(resourceRegistrations[0]?.uri).toBe("project://info");
    expect(resourceRegistrations[0]?.config.description).toBe("Describes the MCP starter project.");
    expect(resourceRegistrations[0]?.config.mimeType).toBe("text/plain");
  });

  it("maps a string resource and forwards the URI plus the exact extra reference", async () => {
    const handler = vi.fn().mockResolvedValue("A class-based MCP server starter.");
    const { server, resourceRegistrations } = createCapturingServer();
    const extra = createTestExtra();

    registerCapabilities(server, { tools: [], prompts: [], resources: [createResolvedResource(handler)] });

    const result = await resourceRegistrations[0]?.callback(new URL("project://info"), extra);

    expect(handler).toHaveBeenCalledWith("project://info", extra);

    const passedExtra = handler.mock.calls[0]?.[1] as McpRequestExtraType | undefined;

    expect(passedExtra).toBe(extra);
    expect(passedExtra?.mcpReq.signal).toBe(extra.mcpReq.signal);
    expect(passedExtra?.mcpReq.notify).toBe(extra.mcpReq.notify);
    expect(passedExtra?.mcpReq.log).toBe(extra.mcpReq.log);
    expect(passedExtra?.mcpReq._meta).toBe(extra.mcpReq._meta);
    expect(result).toEqual({
      contents: [{ uri: "project://info", mimeType: "text/plain", text: "A class-based MCP server starter." }],
    });
  });

  it("maps a JSON resource value to application/json", async () => {
    const handler = vi.fn().mockResolvedValue({ name: "starter" });
    const { server, resourceRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], prompts: [], resources: [createResolvedResource(handler)] });

    const result = await resourceRegistrations[0]?.callback(new URL("project://info"), undefined);

    expect(result).toEqual({
      contents: [{ uri: "project://info", mimeType: "application/json", text: JSON.stringify({ name: "starter" }) }],
    });
  });

  it("propagates a resource serialization failure instead of emitting fake contents", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { server, resourceRegistrations } = createCapturingServer();

    registerCapabilities(server, { tools: [], prompts: [], resources: [createResolvedResource(handler)] });

    await expect(resourceRegistrations[0]?.callback(new URL("project://info"), undefined)).rejects.toBeInstanceOf(
      ResourceSerializationError,
    );
  });
});

/**
 * Resolves the shared result-mapping fixtures through a real per-server
 * container and registers them with a capturing server.
 *
 * @returns The capturing server plus its recorded registrations.
 */
function registerResolvedResultFixtures(): ReturnType<typeof createCapturingServer> {
  const container = createAppContainer(resultMappingCapabilities, resultMappingProviders);
  const resolved = resolveCapabilities(container, resultMappingCapabilities);
  const captured = createCapturingServer();

  registerCapabilities(captured.server, resolved);

  return captured;
}

describe("registerCapabilities with resolved result-mapping fixtures", () => {
  it("maps the resolved domain tool and keeps structured content matching", async () => {
    const { registrations } = registerResolvedResultFixtures();
    const registration = registrations.find((item) => item.name === "add");

    const result = await registration?.callback({ a: 1, b: 2 }, undefined);

    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ result: 3 }) }],
      structuredContent: { result: 3 },
    });
  });

  it("returns the resolved mixed-content wire tool result by identity", async () => {
    const { registrations } = registerResolvedResultFixtures();
    const registration = registrations.find((item) => item.name === "wire_tool");

    const result = await registration?.callback({ label: "ignored" }, undefined);

    expect(result).toBe(FixtureWireToolResult);
    expect(result?.content).toHaveLength(3);
  });

  it("maps a resolved throwing tool to safe error text and logs the err key", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const { registrations } = registerResolvedResultFixtures();
    const registration = registrations.find((item) => item.name === "throwing_tool");

    const result = await registration?.callback({ label: "ignored" }, undefined);

    expect(result).toEqual({ isError: true, content: [{ type: "text", text: "fixture tool failure" }] });
    expect(result?.content[0]).not.toEqual(expect.objectContaining({ text: expect.stringContaining("at ") }));
    expect(errorSpy).toHaveBeenCalledWith({ err: expect.any(Error) }, "tool handler failed");
  });

  it("maps the resolved string resource to unquoted text/plain", async () => {
    const { resourceRegistrations } = registerResolvedResultFixtures();
    const registration = resourceRegistrations.find((item) => item.uri === "project://info");

    const result = await registration?.callback(new URL("project://info"), undefined);

    expect(result).toEqual({
      contents: [{ uri: "project://info", mimeType: "text/plain", text: "A class-based MCP server starter." }],
    });
  });

  it("maps the resolved JSON resource to application/json", async () => {
    const { resourceRegistrations } = registerResolvedResultFixtures();
    const registration = resourceRegistrations.find((item) => item.uri === "fixture://json");
    const expected = { name: "fixture", nested: { items: [1, 2, 3] } };

    const result = await registration?.callback(new URL("fixture://json"), undefined);

    expect(result).toEqual({
      contents: [{ uri: "fixture://json", mimeType: "application/json", text: JSON.stringify(expected) }],
    });
  });

  it("returns the resolved binary wire resource by identity with MIME ownership", async () => {
    const { resourceRegistrations } = registerResolvedResultFixtures();
    const registration = resourceRegistrations.find((item) => item.uri === "fixture://blob");

    const result = await registration?.callback(new URL("fixture://blob"), undefined);

    expect(result).toBe(FixtureWireResourceResult);
    expect(result?.contents[0]).toEqual({
      uri: "fixture://blob",
      mimeType: "application/octet-stream",
      blob: "AAECAwQ=",
    });
  });

  it("wraps the resolved string prompt with the decorator default role", async () => {
    const { promptRegistrations } = registerResolvedResultFixtures();
    const registration = promptRegistrations.find((item) => item.name === "code_review");

    const result = await registration?.callback({ code: "const x = 1;" }, undefined);

    expect(result).toEqual({
      messages: [{ role: "user", content: { type: "text", text: "Review the following code:\n\nconst x = 1;" } }],
    });
  });

  it("wraps the resolved string prompt with the assistant role", async () => {
    const { promptRegistrations } = registerResolvedResultFixtures();
    const registration = promptRegistrations.find((item) => item.name === "assistant_prompt");

    const result = await registration?.callback({ topic: "this" }, undefined);

    expect(result).toEqual({
      messages: [{ role: "assistant", content: { type: "text", text: "Assist with this" } }],
    });
  });

  it("returns the resolved mixed-content wire prompt by identity", async () => {
    const { promptRegistrations } = registerResolvedResultFixtures();
    const registration = promptRegistrations.find((item) => item.name === "wire_prompt");

    const result = await registration?.callback({ topic: "ignored" }, undefined);

    expect(result).toBe(FixtureWirePromptResult);
    expect(result?.messages).toHaveLength(3);
  });
});
