// Test-only provider fixtures for container scope and factory injection.
//
// This module exists so container and factory specs can prove lifetime policy
// without importing application code. It imports only `inversify`, `zod`, and
// sibling core modules; never import application modules here.

import type { Container, ResolutionContext } from "inversify";
import { inject, injectable } from "inversify";
import { z } from "zod";

import type { IProviderConfiguration } from "./container";
import { tool } from "./decorators";
import type { ICapabilities, IMcpToolHandler } from "./types";

// Monotonic counter used by tests to prove distinct transient instances.
let transientInstanceCount = 0;

/**
 * Transient fixture service created once per resolution or factory call.
 */
@injectable()
export class FixtureTransientCalculatorService {
  public readonly instanceId: number;

  /**
   * Creates a transient instance and records its identity.
   */
  public constructor() {
    transientInstanceCount += 1;
    this.instanceId = transientInstanceCount;
  }

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
 * Creates a fresh transient calculator for one invocation.
 */
export type FixtureCalculatorFactoryType = () => FixtureTransientCalculatorService;

// Symbol token for the per-invocation calculator factory binding.
export const fixtureServiceTokens = {
  CalculatorFactory: Symbol.for("fixture.CalculatorFactory"),
} as const;

export const FixtureFactoryToolInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

export const FixtureFactoryToolOutputSchema = z.object({
  result: z.number(),
  instanceId: z.number(),
});

/**
 * Decorated fixture tool that creates a calculator for each handler call.
 */
@tool({
  name: "factory_add",
  description: "Adds two numbers with a calculator created per invocation.",
  inputSchema: FixtureFactoryToolInputSchema,
  outputSchema: FixtureFactoryToolOutputSchema,
})
export class FixtureFactoryCalculatorTool implements IMcpToolHandler {
  /**
   * Creates the fixture tool.
   *
   * @param createCalculator - Factory for transient calculator instances.
   */
  public constructor(
    @inject(fixtureServiceTokens.CalculatorFactory)
    private readonly createCalculator: FixtureCalculatorFactoryType,
  ) {}

  /**
   * Adds the supplied numbers with a fresh calculator.
   *
   * @param input - Validated tool input.
   * @returns The structured result plus the calculator identity.
   */
  public handler(
    input: z.output<typeof FixtureFactoryToolInputSchema>,
  ): z.output<typeof FixtureFactoryToolOutputSchema> {
    const calculator = this.createCalculator();

    return { result: calculator.add(input.a, input.b), instanceId: calculator.instanceId };
  }
}

export const fixtureFactoryCapabilities: ICapabilities = {
  tools: [FixtureFactoryCalculatorTool],
  prompts: [],
  resources: [],
};

export const fixtureFactoryProviders: IProviderConfiguration = {
  services: [],

  /**
   * Registers the transient calculator and its per-invocation factory.
   *
   * @param container - Container to configure.
   */
  configure(container: Container): void {
    container.bind(FixtureTransientCalculatorService).toSelf().inTransientScope();

    container
      .bind<FixtureCalculatorFactoryType>(fixtureServiceTokens.CalculatorFactory)
      .toFactory((context: ResolutionContext) => () => context.get(FixtureTransientCalculatorService));
  },
};
