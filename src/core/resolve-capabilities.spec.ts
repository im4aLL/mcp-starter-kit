import type { Newable } from "inversify";
import { describe, expect, it } from "vitest";

import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureCodeReviewPrompt,
  FixtureCodeReviewPromptArgsSchema,
  FixtureProjectInfoResource,
  fixtureCapabilities,
  fixtureProviders,
} from "./core-test-fixtures";
import { getPromptMetadata, getResourceMetadata, prompt, resource } from "./decorators";
import { resolveCapabilities } from "./resolve-capabilities";
import type { ICapabilities, IMcpPromptHandler, IMcpResourceHandler, IMcpToolHandler } from "./types";

/**
 * Tool candidate that never received the `@tool` decorator.
 */
class UndecoratedTool implements IMcpToolHandler {
  /**
   * Returns a trivial result.
   *
   * @returns A constant JSON object.
   */
  public handler(): { readonly ok: boolean } {
    return { ok: true };
  }
}

/**
 * Resource candidate that never received the `@resource` decorator.
 */
class UndecoratedResource implements IMcpResourceHandler {
  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "resource";
  }
}

/**
 * Prompt candidate that never received the `@prompt` decorator.
 */
class UndecoratedPrompt implements IMcpPromptHandler {
  /**
   * Returns a trivial prompt string.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "prompt";
  }
}

let countingInstantiations = 0;

/**
 * Decorated resource that records each instantiation.
 */
@resource({
  uri: "test://counting",
  name: "Counting resource",
  description: "Counts instantiations.",
})
class CountingResource implements IMcpResourceHandler {
  /**
   * Creates the counting resource and records the instantiation.
   */
  public constructor() {
    countingInstantiations += 1;
  }

  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "counted";
  }
}

let countingPromptInstantiations = 0;

/**
 * Decorated prompt that records each instantiation.
 */
@prompt({
  name: "counting_prompt",
  description: "Counts instantiations.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class CountingPrompt implements IMcpPromptHandler {
  /**
   * Creates the counting prompt and records the instantiation.
   */
  public constructor() {
    countingPromptInstantiations += 1;
  }

  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "counted prompt";
  }
}

describe("resolveCapabilities", () => {
  it("resolves a decorated constructor with its metadata and instance", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    const capabilities = resolveCapabilities(container, fixtureCapabilities);

    expect(capabilities.tools).toHaveLength(1);
    expect(capabilities.tools[0]?.metadata.name).toBe("add");
    expect(capabilities.tools[0]?.instance).toBeInstanceOf(FixtureAddTool);
  });

  it("resolves a constructor-injected capability from @tool alone", async () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    const capabilities = resolveCapabilities(container, fixtureCapabilities);
    const output = await capabilities.tools[0]?.instance.handler({ a: 2, b: 3 });

    expect(output).toEqual({ result: 5 });
  });

  it("resolves the decorated resource with its metadata and instance", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    const capabilities = resolveCapabilities(container, fixtureCapabilities);

    expect(capabilities.resources).toHaveLength(1);
    expect(capabilities.resources[0]?.metadata.uri).toBe("project://info");
    expect(capabilities.resources[0]?.metadata.name).toBe("Project information");
    expect(capabilities.resources[0]?.metadata.mimeType).toBe("text/plain");
    expect(capabilities.resources[0]?.instance).toBeInstanceOf(FixtureProjectInfoResource);
  });

  it("resolves a resource handler without parsing the URI", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    const capabilities = resolveCapabilities(container, fixtureCapabilities);
    const output = capabilities.resources[0]?.instance.handler("project://info");

    expect(output).toBe("A class-based MCP server starter.");
  });

  it("resolves the decorated prompt with its metadata and instance", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    const capabilities = resolveCapabilities(container, fixtureCapabilities);

    expect(capabilities.prompts).toHaveLength(1);
    expect(capabilities.prompts[0]?.metadata.name).toBe("code_review");
    expect(capabilities.prompts[0]?.metadata.description).toBe("Requests a focused review of the supplied code.");
    expect(capabilities.prompts[0]?.metadata.argsSchema).toBe(FixtureCodeReviewPromptArgsSchema);
    expect(capabilities.prompts[0]?.metadata.role).toBe("user");
    expect(capabilities.prompts[0]?.instance).toBeInstanceOf(FixtureCodeReviewPrompt);
  });

  it("resolves a prompt handler without parsing the arguments", () => {
    const container = createAppContainer(fixtureCapabilities, fixtureProviders);

    const capabilities = resolveCapabilities(container, fixtureCapabilities);
    const output = capabilities.prompts[0]?.instance.handler({ code: "const x = 1;" });

    expect(output).toBe("Review the following code:\n\nconst x = 1;");
  });

  it("fails before registration when a listed constructor lacks @tool", () => {
    const capabilityTypes: ICapabilities = { tools: [UndecoratedTool], prompts: [], resources: [] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/missing the @tool decorator/);
  });

  it("fails before registration when a listed constructor lacks @resource", () => {
    const capabilityTypes: ICapabilities = { tools: [], prompts: [], resources: [UndecoratedResource] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/missing the @resource decorator/);
  });

  it("fails before registration when a listed constructor lacks @prompt", () => {
    const capabilityTypes: ICapabilities = { tools: [], prompts: [UndecoratedPrompt], resources: [] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/missing the @prompt decorator/);
  });

  it("fails before registration when a resource is listed under the wrong kind", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [],
      resources: [FixtureAddTool as unknown as Newable<IMcpResourceHandler>],
    };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/decorated as a tool, not a resource/);
  });

  it("fails before registration when a tool is listed under the prompts kind", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [FixtureAddTool as unknown as Newable<IMcpPromptHandler>],
      resources: [],
    };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/decorated as a tool, not a prompt/);
  });

  it("produces isolated instances across per-server containers", () => {
    const first = resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), fixtureCapabilities);
    const second = resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), fixtureCapabilities);

    expect(first.tools[0]?.instance).not.toBe(second.tools[0]?.instance);
    expect(first.prompts[0]?.instance).not.toBe(second.prompts[0]?.instance);
    expect(first.resources[0]?.instance).not.toBe(second.resources[0]?.instance);
  });
});

describe("resource instantiation", () => {
  it("instantiates only on runtime resolution, not from metadata listing or binding", () => {
    countingInstantiations = 0;

    expect(getResourceMetadata(CountingResource)?.uri).toBe("test://counting");

    const capabilityTypes: ICapabilities = { tools: [], prompts: [], resources: [CountingResource] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(countingInstantiations).toBe(0);

    const capabilities = resolveCapabilities(container, capabilityTypes);

    expect(capabilities.resources[0]?.instance).toBeInstanceOf(CountingResource);
    expect(capabilities.resources[0]?.instance.handler("test://counting")).toBe("counted");
    expect(countingInstantiations).toBe(1);
  });
});

describe("prompt instantiation", () => {
  it("instantiates only on runtime resolution, not from metadata listing or binding", () => {
    countingPromptInstantiations = 0;

    expect(getPromptMetadata(CountingPrompt)?.name).toBe("counting_prompt");

    const capabilityTypes: ICapabilities = { tools: [], prompts: [CountingPrompt], resources: [] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(countingPromptInstantiations).toBe(0);

    const capabilities = resolveCapabilities(container, capabilityTypes);

    expect(capabilities.prompts[0]?.instance).toBeInstanceOf(CountingPrompt);
    expect(capabilities.prompts[0]?.instance.handler({ code: "x" })).toBe("counted prompt");
    expect(countingPromptInstantiations).toBe(1);
  });
});
