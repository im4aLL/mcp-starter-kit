// Test-only fixtures shared by the core specs.
//
// This module exists so no `src/core/` spec imports application code that a
// user of the starter may edit or delete. It imports only from `inversify`,
// `zod`, and sibling core modules; never import application modules here.

import { inject, injectable } from "inversify";
import { z } from "zod";

import type { IProviderConfiguration } from "./container";
import { resource, tool } from "./decorators";
import type { ICapabilities, IMcpResourceHandler, IMcpToolHandler, IServerConfig } from "./types";

export const FixtureAddToolInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

export const FixtureAddToolOutputSchema = z.object({
  result: z.number(),
});

/**
 * Ordinary fixture service used to prove constructor injection without any
 * application import.
 */
@injectable()
export class FixtureCalculatorService {
  /**
   * Adds two numbers.
   *
   * @param a - First operand.
   * @param b - Second operand.
   * @returns The arithmetic sum.
   */
  public add(a: number, b: number): number {
    return a + b;
  }
}

/**
 * Decorated fixture tool backed by {@link FixtureCalculatorService}.
 */
@tool({
  name: "add",
  description: "Adds two numbers together.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
export class FixtureAddTool implements IMcpToolHandler {
  /**
   * Creates the fixture tool.
   *
   * @param calculator - Calculator used by the fixture tool.
   */
  public constructor(
    @inject(FixtureCalculatorService)
    private readonly calculator: FixtureCalculatorService,
  ) {}

  /**
   * Adds the supplied numbers.
   *
   * @param input - Validated tool input.
   * @returns The structured addition result.
   */
  public handler(input: z.output<typeof FixtureAddToolInputSchema>): z.output<typeof FixtureAddToolOutputSchema> {
    return { result: this.calculator.add(input.a, input.b) };
  }
}

/**
 * Decorated fixture resource returning a static description.
 */
@resource({
  uri: "project://info",
  name: "Project information",
  description: "Describes the MCP starter project.",
  mimeType: "text/plain",
})
export class FixtureProjectInfoResource implements IMcpResourceHandler {
  /**
   * Returns the fixture project description.
   *
   * @param _uri - URI requested by the MCP client.
   * @returns The plain-text fixture description.
   */
  public handler(_uri: string): string {
    return "A class-based MCP server starter.";
  }
}

export const fixtureCapabilities: ICapabilities = {
  tools: [FixtureAddTool],
  prompts: [],
  resources: [FixtureProjectInfoResource],
};

export const fixtureProviders: IProviderConfiguration = {
  services: [FixtureCalculatorService],
};

export const fixtureServerConfig: IServerConfig = {
  name: "test-server",
  version: "9.9.9",
};
