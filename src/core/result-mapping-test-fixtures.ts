// Test-only capability fixtures for result mapping and wire pass-through.
//
// These fixtures let core specs resolve decorated capabilities through a real
// per-server container and invoke both the domain return path and the SDK wire
// pass-through path through the registration callbacks. This module imports
// only `zod`, sibling core modules, and SDK types; never import application
// modules here.

import type { CallToolResult, GetPromptResult, ReadResourceResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { IProviderConfiguration } from "./container";
import {
  FixtureAddTool,
  FixtureCodeReviewPrompt,
  FixtureProjectInfoResource,
  fixtureProviders,
} from "./core-test-fixtures";
import { prompt, resource, tool } from "./decorators";
import type { ICapabilities, IMcpPromptHandler, IMcpResourceHandler, IMcpToolHandler } from "./types";

export const FixtureWireToolInputSchema = z.object({
  label: z.string(),
});

export const FixtureWireToolOutputSchema = z.object({
  result: z.string(),
});

export const FixtureWirePromptArgsSchema = z.object({
  topic: z.string(),
});

export const FixtureWireToolResult: CallToolResult = {
  content: [
    { type: "text", text: "wire text" },
    { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
    {
      type: "resource",
      resource: { uri: "fixture://blob", mimeType: "text/plain", text: "embedded text" },
    },
  ],
  structuredContent: { result: "wire" },
  isError: false,
  _meta: { fixture: "wire-tool" },
};

export const FixtureWireResourceResult: ReadResourceResult = {
  contents: [
    { uri: "fixture://blob", mimeType: "application/octet-stream", blob: "AAECAwQ=" },
    { uri: "fixture://blob", mimeType: "text/plain", text: "companion text" },
  ],
  _meta: { fixture: "wire-resource" },
};

export const FixtureWirePromptResult: GetPromptResult = {
  description: "Mixed-role fixture prompt.",
  messages: [
    { role: "user", content: { type: "text", text: "wire question" } },
    { role: "assistant", content: { type: "image", data: "aGVsbG8=", mimeType: "image/png" } },
    {
      role: "user",
      content: {
        type: "resource",
        resource: { uri: "fixture://blob", mimeType: "text/plain", text: "embedded" },
      },
    },
  ],
  _meta: { fixture: "wire-prompt" },
};

/**
 * Decorated fixture tool that returns a prebuilt wire result with mixed content.
 */
@tool({
  name: "wire_tool",
  description: "Returns a prebuilt mixed-content tool result.",
  inputSchema: FixtureWireToolInputSchema,
  outputSchema: FixtureWireToolOutputSchema,
})
export class FixtureWireTool implements IMcpToolHandler {
  /**
   * Returns the shared mixed-content wire result.
   *
   * @param _input - Validated tool input, intentionally unused.
   * @returns The prebuilt wire result.
   */
  public handler(_input: z.output<typeof FixtureWireToolInputSchema>): CallToolResult {
    return FixtureWireToolResult;
  }
}

/**
 * Decorated fixture tool whose handler throws.
 */
@tool({
  name: "throwing_tool",
  description: "Always throws from the handler.",
  inputSchema: FixtureWireToolInputSchema,
  outputSchema: FixtureWireToolOutputSchema,
})
export class FixtureThrowingTool implements IMcpToolHandler {
  /**
   * Throws a fixture failure.
   *
   * @param _input - Validated tool input, intentionally unused.
   * @returns Never; always throws.
   */
  public handler(_input: z.output<typeof FixtureWireToolInputSchema>): z.output<typeof FixtureWireToolOutputSchema> {
    throw new Error("fixture tool failure");
  }
}

/**
 * Decorated fixture resource returning a prebuilt wire result with binary contents.
 */
@resource({
  uri: "fixture://blob",
  name: "Blob resource",
  description: "Returns prebuilt binary resource contents.",
  mimeType: "application/octet-stream",
})
export class FixtureWireResource implements IMcpResourceHandler {
  /**
   * Returns the shared prebuilt resource contents.
   *
   * @param _uri - URI requested by the MCP client, intentionally unused.
   * @returns The prebuilt wire resource result.
   */
  public handler(_uri: string): ReadResourceResult {
    return FixtureWireResourceResult;
  }
}

/**
 * Decorated fixture resource returning a nested JSON object.
 */
@resource({
  uri: "fixture://json",
  name: "JSON resource",
  description: "Returns a nested JSON object.",
  mimeType: "application/json",
})
export class FixtureJsonResource implements IMcpResourceHandler {
  /**
   * Returns a nested JSON object.
   *
   * @param _uri - URI requested by the MCP client, intentionally unused.
   * @returns The nested JSON fixture value.
   */
  public handler(_uri: string): { readonly name: string; readonly nested: { readonly items: readonly number[] } } {
    return { name: "fixture", nested: { items: [1, 2, 3] } };
  }
}

/**
 * Decorated fixture prompt returning a prebuilt mixed-role, mixed-content result.
 */
@prompt({
  name: "wire_prompt",
  description: "Returns a prebuilt mixed-content prompt result.",
  argsSchema: FixtureWirePromptArgsSchema,
  role: "user",
})
export class FixtureWirePrompt implements IMcpPromptHandler {
  /**
   * Returns the shared prebuilt prompt result.
   *
   * @param _args - Validated prompt arguments, intentionally unused.
   * @returns The prebuilt wire prompt result.
   */
  public handler(_args: z.output<typeof FixtureWirePromptArgsSchema>): GetPromptResult {
    return FixtureWirePromptResult;
  }
}

/**
 * Decorated fixture prompt that uses the assistant string-shortcut role.
 */
@prompt({
  name: "assistant_prompt",
  description: "Wraps a string with the assistant role.",
  argsSchema: FixtureWirePromptArgsSchema,
  role: "assistant",
})
export class FixtureAssistantPrompt implements IMcpPromptHandler {
  /**
   * Builds the assistant fixture prompt text.
   *
   * @param args - Validated prompt arguments.
   * @returns The prompt text.
   */
  public handler(args: z.output<typeof FixtureWirePromptArgsSchema>): string {
    return `Assist with ${args.topic}`;
  }
}

export const resultMappingCapabilities: ICapabilities = {
  tools: [FixtureAddTool, FixtureWireTool, FixtureThrowingTool],
  prompts: [FixtureCodeReviewPrompt, FixtureWirePrompt, FixtureAssistantPrompt],
  resources: [FixtureProjectInfoResource, FixtureWireResource, FixtureJsonResource],
};

export const resultMappingProviders: IProviderConfiguration = fixtureProviders;
