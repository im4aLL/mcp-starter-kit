import type { Newable } from "inversify";
import { describe, expect, it } from "vitest";

import { createAppContainer } from "./container";
import {
  FixtureAddTool,
  FixtureAddToolInputSchema,
  FixtureAddToolOutputSchema,
  FixtureCodeReviewPrompt,
  FixtureCodeReviewPromptArgsSchema,
  FixtureProjectInfoResource,
  fixtureCapabilities,
  fixtureProviders,
} from "./core-test-fixtures";
import { getPromptMetadata, getResourceMetadata, getToolMetadata, prompt, resource, tool } from "./decorators";
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
 * Subclass used to prove resolution never inherits a base class capability.
 */
class ExtendedAddTool extends FixtureAddTool {}

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

let countingToolInstantiations = 0;

/**
 * Decorated tool that records each instantiation.
 */
@tool({
  name: "counting_tool",
  description: "Counts instantiations.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class CountingTool implements IMcpToolHandler {
  /**
   * Creates the counting tool and records the instantiation.
   */
  public constructor() {
    countingToolInstantiations += 1;
  }

  /**
   * Returns a trivial result.
   *
   * @returns A constant JSON object.
   */
  public handler(): { readonly result: number } {
    return { result: 0 };
  }
}

let duplicateToolInstantiations = 0;

/**
 * First tool sharing a duplicate name with {@link DuplicateNameTool}.
 */
@tool({
  name: "duplicate_name",
  description: "First tool with a duplicated name.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class OtherDuplicateNameTool implements IMcpToolHandler {
  /**
   * Creates the duplicate fixture and records the instantiation.
   */
  public constructor() {
    duplicateToolInstantiations += 1;
  }

  /**
   * Returns a trivial result.
   *
   * @returns A constant JSON object.
   */
  public handler(): { readonly result: number } {
    return { result: 0 };
  }
}

/**
 * Second tool that declares the same name as a distinct constructor.
 */
@tool({
  name: "duplicate_name",
  description: "Second tool with a duplicated name.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class DuplicateNameTool implements IMcpToolHandler {
  /**
   * Creates the duplicate fixture and records the instantiation.
   */
  public constructor() {
    duplicateToolInstantiations += 1;
  }

  /**
   * Returns a trivial result.
   *
   * @returns A constant JSON object.
   */
  public handler(): { readonly result: number } {
    return { result: 0 };
  }
}

let duplicatePromptInstantiations = 0;

/**
 * First prompt sharing a duplicate name with {@link DuplicateNamePrompt}.
 */
@prompt({
  name: "duplicate_prompt",
  description: "First prompt with a duplicated name.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class OtherDuplicateNamePrompt implements IMcpPromptHandler {
  /**
   * Creates the duplicate fixture and records the instantiation.
   */
  public constructor() {
    duplicatePromptInstantiations += 1;
  }

  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "first";
  }
}

/**
 * Second prompt that declares the same name as a distinct constructor.
 */
@prompt({
  name: "duplicate_prompt",
  description: "Second prompt with a duplicated name.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class DuplicateNamePrompt implements IMcpPromptHandler {
  /**
   * Creates the duplicate fixture and records the instantiation.
   */
  public constructor() {
    duplicatePromptInstantiations += 1;
  }

  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "second";
  }
}

let duplicateResourceInstantiations = 0;

/**
 * First resource sharing a duplicate URI with {@link DuplicateUriResource}.
 */
@resource({
  uri: "test://duplicate",
  name: "First duplicate resource",
  description: "First resource with a duplicated URI.",
})
class OtherDuplicateUriResource implements IMcpResourceHandler {
  /**
   * Creates the duplicate fixture and records the instantiation.
   */
  public constructor() {
    duplicateResourceInstantiations += 1;
  }

  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "first";
  }
}

/**
 * Second resource that declares the same URI as a distinct constructor.
 */
@resource({
  uri: "test://duplicate",
  name: "Second duplicate resource",
  description: "Second resource with a duplicated URI.",
})
class DuplicateUriResource implements IMcpResourceHandler {
  /**
   * Creates the duplicate fixture and records the instantiation.
   */
  public constructor() {
    duplicateResourceInstantiations += 1;
  }

  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "second";
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

  it("fails before registration for a subclass that has no own @tool metadata", () => {
    const capabilityTypes: ICapabilities = { tools: [ExtendedAddTool], prompts: [], resources: [] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/missing the @tool decorator/);
  });

  it("produces isolated instances across per-server containers", () => {
    const first = resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), fixtureCapabilities);
    const second = resolveCapabilities(createAppContainer(fixtureCapabilities, fixtureProviders), fixtureCapabilities);

    expect(first.tools[0]?.instance).not.toBe(second.tools[0]?.instance);
    expect(first.prompts[0]?.instance).not.toBe(second.prompts[0]?.instance);
    expect(first.resources[0]?.instance).not.toBe(second.resources[0]?.instance);
  });
});

describe("duplicate capability identifiers", () => {
  it("rejects two distinct tool classes that declare the same name", () => {
    const capabilityTypes: ICapabilities = {
      tools: [OtherDuplicateNameTool, DuplicateNameTool],
      prompts: [],
      resources: [],
    };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/Duplicate tool name "duplicate_name"/);
  });

  it("rejects two distinct prompt classes that declare the same name", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [OtherDuplicateNamePrompt, DuplicateNamePrompt],
      resources: [],
    };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/Duplicate prompt name "duplicate_prompt"/);
  });

  it("rejects two distinct resource classes that declare the same URI", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [],
      resources: [OtherDuplicateUriResource, DuplicateUriResource],
    };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(
      /Duplicate resource URI "test:\/\/duplicate"/,
    );
  });

  it("rejects duplicate identifiers before instantiating any listed constructor", () => {
    duplicateToolInstantiations = 0;
    duplicatePromptInstantiations = 0;
    duplicateResourceInstantiations = 0;

    const toolTypes: ICapabilities = {
      tools: [OtherDuplicateNameTool, DuplicateNameTool],
      prompts: [],
      resources: [],
    };
    const promptTypes: ICapabilities = {
      tools: [],
      prompts: [OtherDuplicateNamePrompt, DuplicateNamePrompt],
      resources: [],
    };
    const resourceTypes: ICapabilities = {
      tools: [],
      prompts: [],
      resources: [OtherDuplicateUriResource, DuplicateUriResource],
    };

    expect(() => resolveCapabilities(createAppContainer(toolTypes, fixtureProviders), toolTypes)).toThrow(
      /Duplicate tool name/,
    );
    expect(() => resolveCapabilities(createAppContainer(promptTypes, fixtureProviders), promptTypes)).toThrow(
      /Duplicate prompt name/,
    );
    expect(() => resolveCapabilities(createAppContainer(resourceTypes, fixtureProviders), resourceTypes)).toThrow(
      /Duplicate resource URI/,
    );

    expect(duplicateToolInstantiations).toBe(0);
    expect(duplicatePromptInstantiations).toBe(0);
    expect(duplicateResourceInstantiations).toBe(0);
  });
});

describe("tool instantiation", () => {
  it("instantiates only on runtime resolution, not from metadata listing or binding", () => {
    countingToolInstantiations = 0;

    expect(getToolMetadata(CountingTool)?.name).toBe("counting_tool");

    const capabilityTypes: ICapabilities = { tools: [CountingTool], prompts: [], resources: [] };
    const container = createAppContainer(capabilityTypes, fixtureProviders);

    expect(countingToolInstantiations).toBe(0);

    const capabilities = resolveCapabilities(container, capabilityTypes);

    expect(capabilities.tools[0]?.instance).toBeInstanceOf(CountingTool);
    expect(capabilities.tools[0]?.instance.handler({ a: 0, b: 0 })).toEqual({ result: 0 });
    expect(countingToolInstantiations).toBe(1);
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
