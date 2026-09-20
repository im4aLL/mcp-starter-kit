import { inject, injectable } from "inversify";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureProjectInfoResource,
  fixtureCapabilities,
  fixtureProviders,
  fixtureServerConfig,
} from "./core-test-fixtures";
import { createServer } from "./create-server";
import { tool } from "./decorators";
import { resolveCapabilities } from "./resolve-capabilities";
import type { ICapabilities, IMcpToolHandler } from "./types";

const ConvertToolInputSchema = z.object({ value: z.number() });
const ConvertToolOutputSchema = z.object({ text: z.string() });

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

const heterogeneousTools: ICapabilities["tools"] = [FixtureAddTool, ConvertTool];
const heterogeneousResources: ICapabilities["resources"] = [FixtureProjectInfoResource];

describe("capability type integration", () => {
  it("accepts heterogeneous decorated constructors in one list", () => {
    expect(heterogeneousTools).toHaveLength(2);
    expect(heterogeneousTools[0]).toBe(FixtureAddTool);
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

  it("keeps the negative fixture reachable for the compile-time assertion", () => {
    expect(BadTool).toBeDefined();
    expect(ConvertTool).toBeDefined();
  });
});
