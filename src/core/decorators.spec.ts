import { describe, expect, it } from "vitest";
import { AddTool } from "../tools/add-tool/add-tool";
import { AddToolInputSchema, AddToolOutputSchema } from "../tools/add-tool/add-tool.schemas";
import { getToolMetadata, tool } from "./decorators";
import type { IMcpToolHandler } from "./types";

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
 * Subclass used to prove that metadata is not inherited implicitly.
 */
class ExtendedAddTool extends AddTool {}

describe("getToolMetadata", () => {
  it("reads the direct decorator-owned metadata", () => {
    const metadata = getToolMetadata(AddTool);

    expect(metadata?.name).toBe("add");
    expect(metadata?.description).toBe("Adds two numbers together.");
    expect(metadata?.inputSchema).toBe(AddToolInputSchema);
    expect(metadata?.outputSchema).toBe(AddToolOutputSchema);
  });

  it("returns undefined for an undecorated constructor", () => {
    expect(getToolMetadata(UndecoratedTool)).toBeUndefined();
  });

  it("does not inherit metadata from a decorated base class", () => {
    expect(getToolMetadata(ExtendedAddTool)).toBeUndefined();
  });

  it("stores frozen metadata", () => {
    expect(Object.isFrozen(getToolMetadata(AddTool))).toBe(true);
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
        inputSchema: AddToolInputSchema,
        outputSchema: AddToolOutputSchema,
      })
      @tool({
        name: "first",
        description: "First decoration attempt.",
        inputSchema: AddToolInputSchema,
        outputSchema: AddToolOutputSchema,
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
    expect(AddTool.prototype.constructor).toBe(AddTool);
  });
});
