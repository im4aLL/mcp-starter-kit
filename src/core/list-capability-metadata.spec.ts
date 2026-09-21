import type { Newable } from "inversify";
import { describe, expect, it } from "vitest";

import {
  FixtureAddToolInputSchema,
  FixtureAddToolOutputSchema,
  FixtureCodeReviewPromptArgsSchema,
} from "./core-test-fixtures";
import { prompt, resource, tool } from "./decorators";
import { listCapabilityMetadata, readCapabilityMetadata } from "./list-capability-metadata";
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
 * Tool named to sort after {@link ZuluTool}.
 */
@tool({
  name: "alpha",
  description: "First tool.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class AlphaTool implements IMcpToolHandler {
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
 * Tool named to sort before {@link ZuluTool} in output.
 */
@tool({
  name: "zulu",
  description: "Last tool.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class ZuluTool implements IMcpToolHandler {
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
 * Resource whose display name sorts first.
 */
@resource({
  uri: "test://alpha",
  name: "Alpha resource",
  description: "First resource.",
})
class AlphaResource implements IMcpResourceHandler {
  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "alpha";
  }
}

/**
 * Resource whose display name sorts last.
 */
@resource({
  uri: "test://zulu",
  name: "Zulu resource",
  description: "Last resource.",
})
class ZuluResource implements IMcpResourceHandler {
  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "zulu";
  }
}

/**
 * Prompt whose name sorts first.
 */
@prompt({
  name: "alpha_prompt",
  description: "First prompt.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class AlphaPrompt implements IMcpPromptHandler {
  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "alpha";
  }
}

/**
 * Prompt whose name sorts last.
 */
@prompt({
  name: "zulu_prompt",
  description: "Last prompt.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class ZuluPrompt implements IMcpPromptHandler {
  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "zulu";
  }
}

/**
 * First tool sharing a duplicate name with {@link DuplicateNameTool}.
 */
@tool({
  name: "duplicate",
  description: "First duplicate tool.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class OtherDuplicateNameTool implements IMcpToolHandler {
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
 * Second tool declaring the same name as a distinct constructor.
 */
@tool({
  name: "duplicate",
  description: "Second duplicate tool.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class DuplicateNameTool implements IMcpToolHandler {
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
 * First prompt sharing a duplicate name with {@link DuplicateNamePrompt}.
 */
@prompt({
  name: "duplicate_prompt",
  description: "First duplicate prompt.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class OtherDuplicateNamePrompt implements IMcpPromptHandler {
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
 * Second prompt declaring the same name as a distinct constructor.
 */
@prompt({
  name: "duplicate_prompt",
  description: "Second duplicate prompt.",
  argsSchema: FixtureCodeReviewPromptArgsSchema,
})
class DuplicateNamePrompt implements IMcpPromptHandler {
  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "second";
  }
}

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
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "first";
  }
}

/**
 * Second resource declaring the same URI as a distinct constructor.
 */
@resource({
  uri: "test://duplicate",
  name: "Second duplicate resource",
  description: "Second resource with a duplicated URI.",
})
class DuplicateUriResource implements IMcpResourceHandler {
  /**
   * Returns a trivial resource value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "second";
  }
}

let countingInstantiations = 0;

/**
 * Decorated tool that records each instantiation.
 */
@tool({
  name: "counting",
  description: "Counts instantiations.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class CountingTool implements IMcpToolHandler {
  /**
   * Creates the counting tool and records the instantiation.
   */
  public constructor() {
    countingInstantiations += 1;
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

describe("readCapabilityMetadata", () => {
  it("pairs every listed constructor with its decorator metadata", () => {
    const capabilityTypes: ICapabilities = {
      tools: [AlphaTool],
      prompts: [AlphaPrompt],
      resources: [AlphaResource],
    };

    const listed = readCapabilityMetadata(capabilityTypes);

    expect(listed.tools[0]?.toolConstructor).toBe(AlphaTool);
    expect(listed.tools[0]?.metadata.name).toBe("alpha");
    expect(listed.prompts[0]?.promptConstructor).toBe(AlphaPrompt);
    expect(listed.resources[0]?.resourceConstructor).toBe(AlphaResource);
    expect(listed.resources[0]?.metadata.uri).toBe("test://alpha");
  });

  it("rejects a listed constructor that lacks its capability decorator", () => {
    const capabilityTypes: ICapabilities = { tools: [UndecoratedTool], prompts: [], resources: [] };

    expect(() => readCapabilityMetadata(capabilityTypes)).toThrow(/missing the @tool decorator/);
  });

  it("rejects a listed constructor carrying a different capability decorator", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [],
      resources: [AlphaTool as unknown as Newable<IMcpResourceHandler>],
    };

    expect(() => readCapabilityMetadata(capabilityTypes)).toThrow(/decorated as a tool, not a resource/);
  });

  it("rejects duplicate tool identifiers before any listing", () => {
    const capabilityTypes: ICapabilities = {
      tools: [OtherDuplicateNameTool, DuplicateNameTool],
      prompts: [],
      resources: [],
    };

    expect(() => readCapabilityMetadata(capabilityTypes)).toThrow(
      'Duplicate tool name "duplicate": each listed capability must have a unique identifier.',
    );
  });

  it("rejects duplicate prompt identifiers before any listing", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [OtherDuplicateNamePrompt, DuplicateNamePrompt],
      resources: [],
    };

    expect(() => readCapabilityMetadata(capabilityTypes)).toThrow(
      'Duplicate prompt name "duplicate_prompt": each listed capability must have a unique identifier.',
    );
  });

  it("rejects duplicate resource identifiers before any listing", () => {
    const capabilityTypes: ICapabilities = {
      tools: [],
      prompts: [],
      resources: [OtherDuplicateUriResource, DuplicateUriResource],
    };

    expect(() => readCapabilityMetadata(capabilityTypes)).toThrow(
      'Duplicate resource URI "test://duplicate": each listed capability must have a unique identifier.',
    );
  });
});

describe("listCapabilityMetadata", () => {
  it("normalizes mixed capability kinds into stable columns", () => {
    const capabilityTypes: ICapabilities = {
      tools: [AlphaTool],
      prompts: [AlphaPrompt],
      resources: [AlphaResource],
    };

    expect(listCapabilityMetadata(capabilityTypes)).toEqual([
      {
        type: "tool",
        name: "alpha",
        identifier: "alpha",
        description: "First tool.",
      },
      {
        type: "resource",
        name: "Alpha resource",
        identifier: "test://alpha",
        description: "First resource.",
      },
      {
        type: "prompt",
        name: "alpha_prompt",
        identifier: "alpha_prompt",
        description: "First prompt.",
      },
    ]);
  });

  it("orders rows by capability type then name regardless of listing order", () => {
    const capabilityTypes: ICapabilities = {
      tools: [ZuluTool, AlphaTool],
      prompts: [ZuluPrompt, AlphaPrompt],
      resources: [ZuluResource, AlphaResource],
    };

    expect(listCapabilityMetadata(capabilityTypes).map((row) => `${row.type}:${row.name}`)).toEqual([
      "tool:alpha",
      "tool:zulu",
      "resource:Alpha resource",
      "resource:Zulu resource",
      "prompt:alpha_prompt",
      "prompt:zulu_prompt",
    ]);
  });

  it("returns no rows for an empty constructor list", () => {
    expect(listCapabilityMetadata({ tools: [], prompts: [], resources: [] })).toEqual([]);
  });

  it("reads metadata without invoking any listed constructor", () => {
    countingInstantiations = 0;

    const rows = listCapabilityMetadata({ tools: [CountingTool], prompts: [], resources: [] });

    expect(rows).toEqual([
      {
        type: "tool",
        name: "counting",
        identifier: "counting",
        description: "Counts instantiations.",
      },
    ]);
    expect(countingInstantiations).toBe(0);
  });
});
