import { readFileSync } from "node:fs";

import type { Container } from "inversify";
import { describe, expect, it, vi } from "vitest";

import type { IProviderConfiguration } from "./container";
import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureCalculatorService,
  FixtureCodeReviewPrompt,
  FixtureProjectInfoResource,
  fixtureCapabilities,
  fixtureProviders,
} from "./core-test-fixtures";
import {
  FixtureFactoryCalculatorTool,
  FixtureTransientCalculatorService,
  fixtureFactoryCapabilities,
  fixtureFactoryProviders,
  fixtureServiceTokens,
} from "./provider-test-fixtures";
import { resolveCapabilities } from "./resolve-capabilities";
import type { ICapabilities } from "./types";

const noCapabilities: ICapabilities = { tools: [], prompts: [], resources: [] };

describe("createAppContainer", () => {
  it("self-binds generic provider services without application imports", () => {
    /**
     * Service defined only in the test to prove generic self-binding.
     */
    class SpecOnlyService {}

    const container = createAppContainer(noCapabilities, { services: [SpecOnlyService] });

    expect(container.get(SpecOnlyService)).toBeInstanceOf(SpecOnlyService);
  });

  it("binds listed capability constructors to themselves", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    expect(container.get(FixtureAddTool)).toBeInstanceOf(FixtureAddTool);
    expect(container.get(FixtureCodeReviewPrompt)).toBeInstanceOf(FixtureCodeReviewPrompt);
    expect(container.get(FixtureProjectInfoResource)).toBeInstanceOf(FixtureProjectInfoResource);
  });

  it("returns the same service within one container", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    expect(container.get(FixtureCalculatorService)).toBe(container.get(FixtureCalculatorService));
  });

  it("self-binds every ordinary provider service as a singleton within one container", () => {
    /**
     * First ordinary service listed in the provider configuration.
     */
    class FirstSpecService {}

    /**
     * Second ordinary service listed in the provider configuration.
     */
    class SecondSpecService {}

    const container = createAppContainer(noCapabilities, {
      services: [FirstSpecService, SecondSpecService],
    });

    expect(container.get(FirstSpecService)).toBeInstanceOf(FirstSpecService);
    expect(container.get(FirstSpecService)).toBe(container.get(FirstSpecService));
    expect(container.get(SecondSpecService)).toBeInstanceOf(SecondSpecService);
    expect(container.get(SecondSpecService)).toBe(container.get(SecondSpecService));
  });

  it("isolates services and capabilities across containers", () => {
    const first = createAppContainer(fixtureCapabilities, fixtureProviders);
    const second = createAppContainer(fixtureCapabilities, fixtureProviders);

    expect(first.get(FixtureCalculatorService)).not.toBe(second.get(FixtureCalculatorService));
    expect(first.get(FixtureAddTool)).not.toBe(second.get(FixtureAddTool));
  });

  it("invokes the optional configure callback to override a default binding", () => {
    /**
     * Service rebound to transient scope by the custom configure callback.
     */
    class TransientService {}

    const configure = vi.fn((container: Container) => {
      container.rebind(TransientService).toSelf().inTransientScope();
    });
    const configuration: IProviderConfiguration = { services: [TransientService], configure };

    const container = createAppContainer(noCapabilities, configuration);

    expect(configure).toHaveBeenCalledTimes(1);
    expect(container.get(TransientService)).not.toBe(container.get(TransientService));
  });

  it("keeps core container code free of application service imports", () => {
    const source = readFileSync(new URL("./container.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/CalculatorService|services\/calculator/);
  });
});

describe("custom transient and factory bindings", () => {
  it("returns separate transient instances across resolutions", () => {
    const container = createAppContainer(fixtureFactoryCapabilities, fixtureFactoryProviders);
    const first = resolveCapabilities(container, fixtureFactoryCapabilities);
    const second = resolveCapabilities(container, fixtureFactoryCapabilities);

    expect(container.get(FixtureTransientCalculatorService)).not.toBe(container.get(FixtureTransientCalculatorService));
    expect(first.tools[0]?.instance).toBe(second.tools[0]?.instance);
  });

  it("omits the custom-bound service from the ordinary services list", () => {
    expect(fixtureFactoryProviders.services).not.toContain(FixtureTransientCalculatorService);
  });

  it("fails when a custom-bound service is also listed as an ordinary service", () => {
    const configuration: IProviderConfiguration = {
      services: [FixtureTransientCalculatorService],

      /**
       * Binds the same service again, producing a duplicate binding.
       *
       * @param container - Container to configure.
       */
      configure(container: Container): void {
        container.bind(FixtureTransientCalculatorService).toSelf().inTransientScope();
      },
    };

    const container = createAppContainer(noCapabilities, configuration);

    expect(() => container.get(FixtureTransientCalculatorService)).toThrow(/Ambiguous bindings/);
  });

  it("shares a default-singleton service within one container but never across containers", () => {
    const first = createAppContainer(fixtureCapabilities, fixtureProviders);
    const second = createAppContainer(fixtureCapabilities, fixtureProviders);

    expect(first.get(FixtureCalculatorService)).toBe(first.get(FixtureCalculatorService));
    expect(first.get(FixtureCalculatorService)).not.toBe(second.get(FixtureCalculatorService));
  });

  it("creates a distinct transient service on each factory call", () => {
    const container = createAppContainer(noCapabilities, fixtureFactoryProviders);
    const createCalculator = container.get<() => FixtureTransientCalculatorService>(
      fixtureServiceTokens.CalculatorFactory,
    );

    expect(createCalculator()).not.toBe(createCalculator());
  });

  it("creates a new service for each handler invocation of one resolved singleton tool", () => {
    const container = createAppContainer(fixtureFactoryCapabilities, fixtureFactoryProviders);
    const resolved = resolveCapabilities(container, fixtureFactoryCapabilities);
    const tool = container.get(FixtureFactoryCalculatorTool);

    expect(resolved.tools[0]?.instance).toBe(tool);

    const first = tool.handler({ a: 1, b: 2 });
    const second = tool.handler({ a: 3, b: 4 });

    expect(first.result).toBe(3);
    expect(second.result).toBe(7);
    expect(first.instanceId).not.toBe(second.instanceId);
  });
});
