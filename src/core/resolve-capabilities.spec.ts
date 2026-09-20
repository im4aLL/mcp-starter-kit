import type { Newable } from "inversify";
import { describe, expect, it } from "vitest";

import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureProjectInfoResource,
  fixtureCapabilities,
  fixtureProviders,
} from "./core-test-fixtures";
import { getResourceMetadata, resource } from "./decorators";
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
 * Prompt candidate used to prove unimplemented kinds are rejected.
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

  it("fails before registration when a resource is listed under the wrong kind", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [],
      resources: [FixtureAddTool as unknown as Newable<IMcpResourceHandler>],
    };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/decorated as a tool, not a resource/);
  });

  it("rejects unimplemented prompt capability kinds instead of dropping them", () => {
    expect(() =>
      resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), {
        ...fixtureCapabilities,
        prompts: [UndecoratedPrompt],
      }),
    ).toThrow(/not implemented/);
  });

  it("produces isolated instances across per-server containers", () => {
    const first = resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), fixtureCapabilities);
    const second = resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), fixtureCapabilities);

    expect(first.tools[0]?.instance).not.toBe(second.tools[0]?.instance);
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
