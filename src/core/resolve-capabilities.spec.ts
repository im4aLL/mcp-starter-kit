import { describe, expect, it } from "vitest";

import { getCapabilityTypes } from "../capabilities/capabilities";
import { providers } from "../providers";
import { AddTool } from "../tools/add-tool/add-tool";
import { createAppContainer } from "./container";
import { resolveCapabilities } from "./resolve-capabilities";
import type { ICapabilities, IMcpPromptHandler, IMcpToolHandler } from "./types";

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

describe("resolveCapabilities", () => {
  it("resolves a decorated constructor with its metadata and instance", () => {
    const capabilityTypes = getCapabilityTypes();
    const container = createAppContainer(capabilityTypes, providers);

    const capabilities = resolveCapabilities(container, capabilityTypes);

    expect(capabilities.tools).toHaveLength(1);
    expect(capabilities.tools[0]?.metadata.name).toBe("add");
    expect(capabilities.tools[0]?.instance).toBeInstanceOf(AddTool);
  });

  it("resolves a constructor-injected capability from @tool alone", async () => {
    const capabilityTypes = getCapabilityTypes();
    const container = createAppContainer(capabilityTypes, providers);

    const capabilities = resolveCapabilities(container, capabilityTypes);
    const output = await capabilities.tools[0]?.instance.handler({ a: 2, b: 3 });

    expect(output).toEqual({ result: 5 });
  });

  it("fails before registration when a listed constructor lacks @tool", () => {
    const capabilityTypes: ICapabilities = { tools: [UndecoratedTool], prompts: [], resources: [] };
    const container = createAppContainer(capabilityTypes, providers);

    expect(() => resolveCapabilities(container, capabilityTypes)).toThrow(/missing the @tool decorator/);
  });

  it("rejects unimplemented capability kinds instead of dropping them", () => {
    const capabilityTypes = getCapabilityTypes();

    expect(() =>
      resolveCapabilities(createAppContainer(capabilityTypes, providers), {
        ...capabilityTypes,
        prompts: [UndecoratedPrompt],
      }),
    ).toThrow(/not implemented/);
  });

  it("produces isolated instances across per-server containers", () => {
    const first = resolveCapabilities(createAppContainer(getCapabilityTypes(), providers), getCapabilityTypes());
    const second = resolveCapabilities(createAppContainer(getCapabilityTypes(), providers), getCapabilityTypes());

    expect(first.tools[0]?.instance).not.toBe(second.tools[0]?.instance);
  });
});
