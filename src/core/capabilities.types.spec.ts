import type { PromptCallback, ReadResourceCallback, ToolCallback } from "@modelcontextprotocol/server";
import { inject, injectable } from "inversify";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureCodeReviewPrompt,
  FixtureProjectInfoResource,
  fixtureCapabilities,
  fixtureProviders,
  fixtureServerConfig,
} from "./core-test-fixtures";
import { createServer } from "./create-server";
import { prompt, tool } from "./decorators";
import { resolveCapabilities } from "./resolve-capabilities";
import type { ICapabilities, IMcpPromptHandler, IMcpToolHandler, McpRequestExtraType } from "./types";

// Bidirectional assignability proof between the SDK callback extra parameter and the alias.
type AssertSameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const ConvertToolInputSchema = z.object({ value: z.number() });
const ConvertToolOutputSchema = z.object({ text: z.string() });

const sdkToolExtraMatches: AssertSameType<Parameters<ToolCallback<undefined>>[0], McpRequestExtraType> = true;
const sdkResourceExtraMatches: AssertSameType<Parameters<ReadResourceCallback>[1], McpRequestExtraType> = true;
const sdkPromptExtraMatches: AssertSameType<Parameters<PromptCallback<undefined>>[0], McpRequestExtraType> = true;
const sdkToolExtraWithSchemaMatches: AssertSameType<
  Parameters<ToolCallback<typeof ConvertToolInputSchema>>[1],
  McpRequestExtraType
> = true;
const sdkPromptExtraWithSchemaMatches: AssertSameType<
  Parameters<PromptCallback<typeof ConvertToolInputSchema>>[1],
  McpRequestExtraType
> = true;

/**
 * Ordinary dependency for the second decorated tool in the type fixture.
 */
@injectable()
class FormatterService {
  /**
   * Formats a number as text.
   *
   * @param value - Value to format.
   * @returns The formatted value.
   */
  public format(value: number): string {
    return String(value);
  }
}

/**
 * Second decorated tool with different schemas and a constructor dependency.
 */
@tool({
  name: "convert",
  description: "Converts a number to text.",
  inputSchema: ConvertToolInputSchema,
  outputSchema: ConvertToolOutputSchema,
})
class ConvertTool implements IMcpToolHandler {
  /**
   * Creates the type fixture tool.
   *
   * @param formatter - Formatter dependency.
   */
  public constructor(
    @inject(FormatterService)
    private readonly formatter: FormatterService,
  ) {}

  /**
   * Converts the supplied number.
   *
   * @param input - Validated input.
   * @returns The converted output.
   */
  public handler(input: z.output<typeof ConvertToolInputSchema>): z.output<typeof ConvertToolOutputSchema> {
    return { text: this.formatter.format(input.value) };
  }
}

const BadToolInputSchema = z.object({ n: z.number() });
const BadToolOutputSchema = z.object({ value: z.string() });

// @ts-expect-error - the handler result does not match the output schema.
@tool({
  name: "bad",
  description: "Type fixture rejected by the decorator.",
  inputSchema: BadToolInputSchema,
  outputSchema: BadToolOutputSchema,
})
class BadTool implements IMcpToolHandler {
  /**
   * Returns an incompatible result for the declared output schema.
   *
   * The value is a valid JSON object, so the erased handler contract accepts
   * it; only the typed `@tool` decorator rejects it.
   *
   * @param input - Validated input.
   * @returns An object whose shape does not match the output schema.
   */
  public handler(input: z.output<typeof BadToolInputSchema>): { readonly value: number } {
    return { value: input.n };
  }
}

const ScalarToolInputSchema = z.object({ value: z.number() });

/**
 * Tool rejected by the typed decorator for a top-level scalar output schema.
 *
 * MCP structured tool output is object-shaped, so a top-level scalar output
 * schema does not satisfy the `@tool` output-schema constraint.
 */
@tool({
  name: "scalar",
  description: "Type fixture rejected for a top-level scalar output schema.",
  inputSchema: ScalarToolInputSchema,
  // @ts-expect-error - a top-level scalar output schema is not an object-shaped MCP structured output.
  outputSchema: z.number(),
})
class ScalarOutputTool implements IMcpToolHandler {
  /**
   * Returns a wrapped object despite the rejected scalar output schema.
   *
   * The handler itself is valid; only the typed `@tool` decorator rejects the
   * scalar output schema.
   *
   * @param input - Validated input.
   * @returns An object-wrapped value.
   */
  public handler(input: z.output<typeof ScalarToolInputSchema>): { readonly result: number } {
    return { result: input.value };
  }
}

const BadPromptArgsSchema = z.object({ code: z.string() });

// @ts-expect-error - the handler argument does not match the prompt args schema.
@prompt({
  name: "bad_prompt",
  description: "Type fixture rejected by the prompt decorator.",
  argsSchema: BadPromptArgsSchema,
})
class BadPrompt implements IMcpPromptHandler {
  /**
   * Returns a prompt text for an incompatible argument shape.
   *
   * The erased handler contract accepts `unknown`; only the typed `@prompt`
   * decorator rejects this argument shape.
   *
   * @param args - Mismatched prompt arguments.
   * @returns The message text.
   */
  public handler(args: { readonly message: string }): string {
    return args.message;
  }
}

const heterogeneousTools: ICapabilities["tools"] = [FixtureAddTool, ConvertTool];
const heterogeneousPrompts: ICapabilities["prompts"] = [FixtureCodeReviewPrompt];
const heterogeneousResources: ICapabilities["resources"] = [FixtureProjectInfoResource];

describe("capability type integration", () => {
  it("accepts heterogeneous decorated constructors in one list", () => {
    expect(heterogeneousTools).toHaveLength(2);
    expect(heterogeneousTools[0]).toBe(FixtureAddTool);
    expect(heterogeneousPrompts).toHaveLength(1);
    expect(heterogeneousPrompts[0]).toBe(FixtureCodeReviewPrompt);
    expect(heterogeneousResources).toHaveLength(1);
    expect(heterogeneousResources[0]).toBe(FixtureProjectInfoResource);
  });

  it("resolves, invokes the erased handler, and registers the fixture tool without casts", async () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);
    const capabilities = resolveCapabilities(container, fixtureCapabilities);
    const server = createServer(capabilities, fixtureServerConfig);

    const resolved = capabilities.tools[0];
    const output = await resolved?.instance.handler({ a: 1, b: 2 });

    expect(resolved?.instance).toBeInstanceOf(FixtureAddTool);
    expect(output).toEqual({ result: 3 });
    expect(server).toBeDefined();
  });

  it("resolves and invokes the erased resource handler without casts", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);
    const capabilities = resolveCapabilities(container, fixtureCapabilities);
    const resource = capabilities.resources[0];

    expect(fixtureCapabilities.resources).toContain(FixtureProjectInfoResource);
    expect(resource?.instance).toBeInstanceOf(FixtureProjectInfoResource);
    expect(resource?.instance.handler("project://info")).toBe("A class-based MCP server starter.");
  });

  it("resolves and invokes the erased prompt handler without casts", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);
    const capabilities = resolveCapabilities(container, fixtureCapabilities);
    const resolved = capabilities.prompts[0];

    expect(fixtureCapabilities.prompts).toContain(FixtureCodeReviewPrompt);
    expect(resolved?.instance).toBeInstanceOf(FixtureCodeReviewPrompt);
    expect(resolved?.instance.handler({ code: "const x = 1;" })).toBe("Review the following code:\n\nconst x = 1;");
  });

  it("keeps the negative fixture reachable for the compile-time assertion", () => {
    expect(BadTool).toBeDefined();
    expect(BadPrompt).toBeDefined();
    expect(ScalarOutputTool).toBeDefined();
    expect(ConvertTool).toBeDefined();
  });

  it("proves the SDK callback extra parameter matches McpRequestExtraType in both directions", () => {
    expect(sdkToolExtraMatches).toBe(true);
    expect(sdkResourceExtraMatches).toBe(true);
    expect(sdkPromptExtraMatches).toBe(true);
    expect(sdkToolExtraWithSchemaMatches).toBe(true);
    expect(sdkPromptExtraWithSchemaMatches).toBe(true);
  });
});
