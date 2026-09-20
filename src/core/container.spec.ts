import { readFileSync } from "node:fs";

import type { Container } from "inversify";
import { describe, expect, it, vi } from "vitest";

import { getCapabilityTypes } from "../capabilities/capabilities";
import { providers } from "../providers";
import { CalculatorService } from "../services/calculator-service";
import { AddTool } from "../tools/add-tool/add-tool";
import type { IProviderConfiguration } from "./container";
import { createAppContainer } from "./container";
import type { ICapabilities } from "./types";

// Capability list with no constructors, for provider-only container tests.
const noCapabilities: ICapabilities = { tools: [], prompts: [], resources: [] };

describe("providers configuration", () => {
  it("lists CalculatorService as an ordinary service", () => {
    expect(providers.services).toContain(CalculatorService);
  });
});

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
    const container = createAppContainer(getCapabilityTypes(), providers);

    expect(container.get(AddTool)).toBeInstanceOf(AddTool);
  });

  it("returns the same service within one container", () => {
    const container = createAppContainer(getCapabilityTypes(), providers);

    expect(container.get(CalculatorService)).toBe(container.get(CalculatorService));
  });

  it("isolates services and capabilities across containers", () => {
    const first = createAppContainer(getCapabilityTypes(), providers);
    const second = createAppContainer(getCapabilityTypes(), providers);

    expect(first.get(CalculatorService)).not.toBe(second.get(CalculatorService));
    expect(first.get(AddTool)).not.toBe(second.get(AddTool));
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
