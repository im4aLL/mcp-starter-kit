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
