import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { getCapabilityTypes } from "./capabilities/capabilities";
import { FixtureAddToolInputSchema, FixtureAddToolOutputSchema } from "./core/core-test-fixtures";
import { tool } from "./core/decorators";
import { listCapabilityMetadata } from "./core/list-capability-metadata";
import type { ICapabilityMetadataRow, IMcpToolHandler } from "./core/types";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "..");
const listScript = resolve(repoRoot, "scripts/list-capabilities.mjs");
const listModuleUrl = pathToFileURL(listScript).href;

// Minimal output sink used to observe rendering without touching the console.
interface IOutputSink {
  table(rows: readonly ICapabilityMetadataRow[]): void;
  log(message: string): void;
}

// Minimal stderr sink used to observe failure messages.
interface IErrorSink {
  write(text: string): void;
}

// Exported surface of `scripts/list-capabilities.mjs` used by these tests.
interface IListCapabilitiesModule {
  listCapabilityRows(options?: Record<string, unknown>): Promise<readonly ICapabilityMetadataRow[]>;
  renderCapabilityRows(rows: readonly ICapabilityMetadataRow[], output?: IOutputSink): void;
  runListCapabilities(options?: Record<string, unknown>): Promise<number>;
}

// A composition module injected in place of the built `dist/list-capabilities.js`.
interface ICompositionModule {
  getCapabilityTypes(): unknown;
  listCapabilityMetadata(capabilityTypes: unknown): readonly ICapabilityMetadataRow[];
}

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

/**
 * First tool sharing a duplicate name with {@link DuplicateTool}.
 */
@tool({
  name: "duplicate_tool",
  description: "First duplicate tool.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class OtherDuplicateTool implements IMcpToolHandler {
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
  name: "duplicate_tool",
  description: "Second duplicate tool.",
  inputSchema: FixtureAddToolInputSchema,
  outputSchema: FixtureAddToolOutputSchema,
})
class DuplicateTool implements IMcpToolHandler {
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
 * Loads the listing script module through its file URL.
 *
 * @returns The script's exported functions.
 */
async function loadListModule(): Promise<IListCapabilitiesModule> {
  return import(listModuleUrl) as Promise<IListCapabilitiesModule>;
}

/**
 * Builds a fake composition module around an injected capability list.
 *
 * @param capabilityTypes - Capability constructor lists returned by the fake module.
 * @returns A composition module exposing the real metadata listing function.
 */
function createComposition(capabilityTypes: unknown): ICompositionModule {
  return {
    getCapabilityTypes: () => capabilityTypes,
    listCapabilityMetadata,
  };
}

/**
 * Creates a spy output sink.
 *
 * @returns An output sink whose calls can be inspected.
 */
function createOutputSink(): IOutputSink {
  return {
    table: vi.fn(),
    log: vi.fn(),
  };
}

/**
 * Creates a spy stderr sink.
 *
 * @returns An error sink whose writes can be inspected.
 */
function createErrorSink(): IErrorSink {
  return { write: vi.fn() };
}

describe("list-capabilities script", () => {
  it("prints the starter capabilities from an injected composition without a build", async () => {
    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();
    const exitCode = await module.runListCapabilities({
      loadModule: async () => createComposition(getCapabilityTypes()),
      output,
      errorOutput,
    });

    expect(exitCode).toBe(0);
    expect(errorOutput.write).not.toHaveBeenCalled();
    expect(output.log).not.toHaveBeenCalled();
    expect(output.table).toHaveBeenCalledTimes(1);

    const rows = vi.mocked(output.table).mock.calls[0]?.[0] ?? [];

    expect(rows.map((row) => `${row.type}:${row.identifier}`)).toEqual([
      "tool:add",
      "resource:project://info",
      "prompt:code_review",
    ]);
    expect(rows[0]?.description).toBe("Adds two numbers together.");
  });

  it("prints a clear message when no capability constructors are registered", async () => {
    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();
    const exitCode = await module.runListCapabilities({
      loadModule: async () => createComposition({ tools: [], prompts: [], resources: [] }),
      output,
      errorOutput,
    });

    expect(exitCode).toBe(0);
    expect(output.table).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalledWith(
      "No capability constructors are registered. Add one to getCapabilityTypes() in src/capabilities/capabilities.ts.",
    );
  });

  it("fails with recovery guidance when listed decorator metadata is invalid", async () => {
    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();
    const exitCode = await module.runListCapabilities({
      loadModule: async () => createComposition({ tools: [UndecoratedTool], prompts: [], resources: [] }),
      output,
      errorOutput,
    });

    expect(exitCode).toBe(1);
    expect(output.table).not.toHaveBeenCalled();

    const message = vi.mocked(errorOutput.write).mock.calls[0]?.[0] ?? "";

    expect(message).toContain("missing the @tool decorator");
    expect(message).toContain("npm run build");
  });

  it("fails with recovery guidance when two listed tools share an identifier", async () => {
    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();
    const exitCode = await module.runListCapabilities({
      loadModule: async () =>
        createComposition({ tools: [OtherDuplicateTool, DuplicateTool], prompts: [], resources: [] }),
      output,
      errorOutput,
    });

    expect(exitCode).toBe(1);
    expect(output.table).not.toHaveBeenCalled();

    const message = vi.mocked(errorOutput.write).mock.calls[0]?.[0] ?? "";

    expect(message).toContain('Duplicate tool name "duplicate_tool"');
    expect(message).toContain("npm run build");
  });

  it("fails as a module-load failure when a capability class has multiple decorators", async () => {
    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();

    // The injected loader throws the same error a real `import()` raises when
    // a capability class carries two capability decorators: the second
    // decorator calls `assertNotDecorated` during class evaluation, before the
    // module finishes loading. This keeps the test filesystem-independent.
    const exitCode = await module.runListCapabilities({
      loadModule: async () => {
        throw new Error('Class "DoubleTool" already has a capability decorator.');
      },
      output,
      errorOutput,
    });

    expect(exitCode).toBe(1);

    const message = vi.mocked(errorOutput.write).mock.calls[0]?.[0] ?? "";

    expect(message).toContain("Failed to load");
    expect(message).toContain("already has a capability decorator");
    expect(message).toContain("npm run build");
  });

  it("fails clearly when the built listing output is missing", async () => {
    const module = await loadListModule();
    const missingEntry = resolve(repoRoot, "dist", "__missing-list-capabilities__.js");

    await expect(module.listCapabilityRows({ entryPath: missingEntry })).rejects.toThrow(
      /Failed to load[\s\S]*npm run build/,
    );
  });

  it("fails clearly when the built listing output predates the listing API", async () => {
    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();
    const exitCode = await module.runListCapabilities({
      loadModule: async () => ({}),
      output,
      errorOutput,
    });

    expect(exitCode).toBe(1);

    const message = vi.mocked(errorOutput.write).mock.calls[0]?.[0] ?? "";

    expect(message).toContain("missing expected exports");
    expect(message).toContain("npm run build");
  });

  it("never invokes a listed constructor", async () => {
    countingInstantiations = 0;

    const module = await loadListModule();
    const output = createOutputSink();
    const errorOutput = createErrorSink();
    const exitCode = await module.runListCapabilities({
      loadModule: async () => createComposition({ tools: [CountingTool], prompts: [], resources: [] }),
      output,
      errorOutput,
    });

    expect(exitCode).toBe(0);
    expect(countingInstantiations).toBe(0);

    const rows = vi.mocked(output.table).mock.calls[0]?.[0] ?? [];

    expect(rows.map((row) => row.identifier)).toEqual(["counting"]);
  });

  it("renders an empty row list through the injected output sink", async () => {
    const module = await loadListModule();
    const output = createOutputSink();

    module.renderCapabilityRows([], output);

    expect(output.table).not.toHaveBeenCalled();
    expect(output.log).toHaveBeenCalledTimes(1);
  });
});
