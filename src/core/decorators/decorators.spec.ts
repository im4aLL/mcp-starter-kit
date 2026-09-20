import { describe, expect, it } from "vitest";

import {
  FixtureAddTool,
  FixtureAddToolInputSchema,
  FixtureAddToolOutputSchema,
  FixtureCodeReviewPrompt,
  FixtureCodeReviewPromptArgsSchema,
  FixtureProjectInfoResource,
} from "../core-test-fixtures";
import type { IMcpPromptHandler, IMcpResourceHandler, IMcpToolHandler } from "../types";
import type { PromptDecoratorTargetType, ResourceDecoratorTargetType } from "./index";
import { getPromptMetadata, getResourceMetadata, getToolMetadata, prompt, resource, tool } from "./index";

/**
 * Plain capability used to prove that undecorated constructors have no
 * capability metadata.
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
 * Plain resource used to prove that undecorated constructors have no
 * resource metadata.
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
 * Plain prompt used to prove that undecorated constructors have no
 * prompt metadata.
 */
class UndecoratedPrompt implements IMcpPromptHandler {
  /**
   * Returns a trivial prompt value.
   *
   * @returns A constant string.
   */
  public handler(): string {
    return "prompt";
  }
}

/**
 * Subclass used to prove that metadata is not inherited implicitly.
 */
class ExtendedAddTool extends FixtureAddTool {}

/**
 * Resource subclass used to prove that resource metadata is not inherited.
 */
class ExtendedProjectInfoResource extends FixtureProjectInfoResource {}

/**
 * Prompt subclass used to prove that prompt metadata is not inherited.
 */
class ExtendedCodeReviewPrompt extends FixtureCodeReviewPrompt {}

describe("getToolMetadata", () => {
  it("reads the direct decorator-owned metadata", () => {
    const metadata = getToolMetadata(FixtureAddTool);

    expect(metadata?.name).toBe("add");
    expect(metadata?.description).toBe("Adds two numbers together.");
    expect(metadata?.inputSchema).toBe(FixtureAddToolInputSchema);
    expect(metadata?.outputSchema).toBe(FixtureAddToolOutputSchema);
  });

  it("returns undefined for an undecorated constructor", () => {
    expect(getToolMetadata(UndecoratedTool)).toBeUndefined();
  });

  it("does not inherit metadata from a decorated base class", () => {
    expect(getToolMetadata(ExtendedAddTool)).toBeUndefined();
  });

  it("stores frozen metadata", () => {
    expect(Object.isFrozen(getToolMetadata(FixtureAddTool))).toBe(true);
  });
});

describe("getResourceMetadata", () => {
  it("reads the direct decorator-owned metadata", () => {
    const metadata = getResourceMetadata(FixtureProjectInfoResource);

    expect(metadata?.uri).toBe("project://info");
    expect(metadata?.name).toBe("Project information");
    expect(metadata?.description).toBe("Describes the MCP starter project.");
    expect(metadata?.mimeType).toBe("text/plain");
  });

  it("returns undefined for an undecorated constructor", () => {
    expect(getResourceMetadata(UndecoratedResource)).toBeUndefined();
  });

  it("does not inherit metadata from a decorated base class", () => {
    expect(getResourceMetadata(ExtendedProjectInfoResource)).toBeUndefined();
  });

  it("stores frozen metadata", () => {
    expect(Object.isFrozen(getResourceMetadata(FixtureProjectInfoResource))).toBe(true);
  });

  it("rejects reading a resource as a tool", () => {
    expect(() => getToolMetadata(FixtureProjectInfoResource)).toThrow(/not a tool/);
  });

  it("rejects reading a tool as a resource", () => {
    expect(() => getResourceMetadata(FixtureAddTool)).toThrow(/not a resource/);
  });
});

describe("getPromptMetadata", () => {
  it("reads the direct decorator-owned metadata", () => {
    const metadata = getPromptMetadata(FixtureCodeReviewPrompt);

    expect(metadata?.name).toBe("code_review");
    expect(metadata?.description).toBe("Requests a focused review of the supplied code.");
    expect(metadata?.argsSchema).toBe(FixtureCodeReviewPromptArgsSchema);
    expect(metadata?.role).toBe("user");
  });

  it("returns undefined for an undecorated constructor", () => {
    expect(getPromptMetadata(UndecoratedPrompt)).toBeUndefined();
  });

  it("does not inherit metadata from a decorated base class", () => {
    expect(getPromptMetadata(ExtendedCodeReviewPrompt)).toBeUndefined();
  });

  it("stores frozen metadata", () => {
    expect(Object.isFrozen(getPromptMetadata(FixtureCodeReviewPrompt))).toBe(true);
  });

  it("rejects reading a prompt as a tool", () => {
    expect(() => getToolMetadata(FixtureCodeReviewPrompt)).toThrow(/not a tool/);
  });

  it("rejects reading a prompt as a resource", () => {
    expect(() => getResourceMetadata(FixtureCodeReviewPrompt)).toThrow(/not a resource/);
  });

  it("rejects reading a tool as a prompt", () => {
    expect(() => getPromptMetadata(FixtureAddTool)).toThrow(/not a prompt/);
  });
});

describe("@tool", () => {
  it("rejects a constructor that already has a capability decorator", () => {
    expect(() => {
      /**
       * Class decorated twice to prove the duplicate guard.
       */
      @tool({
        name: "second",
        description: "Second decoration attempt.",
        inputSchema: FixtureAddToolInputSchema,
        outputSchema: FixtureAddToolOutputSchema,
      })
      @tool({
        name: "first",
        description: "First decoration attempt.",
        inputSchema: FixtureAddToolInputSchema,
        outputSchema: FixtureAddToolOutputSchema,
      })
      class DoublyDecoratedTool implements IMcpToolHandler {
        /**
         * Returns a trivial result.
         *
         * @returns A constant JSON object.
         */
        public handler(): { readonly result: number } {
          return { result: 0 };
        }
      }

      void DoublyDecoratedTool;
    }).toThrow(/already has a capability decorator/);
  });

  it("does not replace the decorated constructor", () => {
    expect(FixtureAddTool.prototype.constructor).toBe(FixtureAddTool);
  });
});

describe("@resource", () => {
  it("rejects a constructor that already has a capability decorator", () => {
    expect(() => {
      resource({
        uri: "test://second",
        name: "Second",
        description: "Second decoration attempt.",
      })(FixtureAddTool as unknown as ResourceDecoratorTargetType);
    }).toThrow(/already has a capability decorator/);
  });

  it("does not replace the decorated constructor", () => {
    expect(FixtureProjectInfoResource.prototype.constructor).toBe(FixtureProjectInfoResource);
  });
});

describe("@prompt", () => {
  it("rejects a constructor that already has a capability decorator", () => {
    expect(() => {
      prompt({
        name: "second",
        description: "Second decoration attempt.",
        argsSchema: FixtureCodeReviewPromptArgsSchema,
      })(FixtureAddTool as unknown as PromptDecoratorTargetType<typeof FixtureCodeReviewPromptArgsSchema>);
    }).toThrow(/already has a capability decorator/);
  });

  it("does not replace the decorated constructor", () => {
    expect(FixtureCodeReviewPrompt.prototype.constructor).toBe(FixtureCodeReviewPrompt);
  });
});
