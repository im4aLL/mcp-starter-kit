import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { ICapabilities, ICapabilityMetadataRow } from "../src/core/types";

// Row sink the listing renders through; the script defaults to the console.
interface IRowsSink {
  table(rows: readonly ICapabilityMetadataRow[]): void;
  log(message: string): void;
}

// Message sink the listing reports failures through; the script defaults to stderr.
interface IErrorSink {
  write(text: string): void;
}

// Composition the listing reads through; both members come from application source.
interface ICapabilityComposition {
  getCapabilityTypes(): ICapabilities;
  listCapabilityMetadata(capabilityTypes: ICapabilities): readonly ICapabilityMetadataRow[];
}

// Options accepted by `listCapabilityRows` and `runListCapabilities`.
interface IListCapabilitiesOptions {
  loadModule?: () => Promise<ICapabilityComposition>;
  output?: IRowsSink;
  errorOutput?: IErrorSink;
}

const EMPTY_CAPABILITIES_MESSAGE =
  "No capability constructors are registered. Add one to getCapabilityTypes() in src/capabilities/capabilities.ts.";

/**
 * Formats a failure to load the application capability sources.
 *
 * A failed load covers any class-evaluation error, such as a capability class
 * that carries multiple capability decorators.
 *
 * @param error - Import failure raised while loading the source modules.
 * @returns A multi-line, actionable error message.
 */
function formatLoadFailure(error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);

  return ["Failed to load the capability sources.", reason, "Fix the capability modules under src/, then retry."].join(
    "\n",
  );
}

/**
 * Formats a decorator metadata validation failure.
 *
 * @param error - Validation error raised while reading listed metadata.
 * @returns A multi-line, actionable error message.
 */
function formatMetadataFailure(error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);

  return [
    "Capability metadata listing failed.",
    reason,
    "Fix the listed constructors in src/capabilities/capabilities.ts, then retry.",
  ].join("\n");
}

/**
 * Loads the application capability list and the metadata listing API from source.
 *
 * Both modules resolve `src/core/capability-metadata.ts` to a single module
 * instance, so the metadata the decorators write and the metadata the listing
 * reads share one key. This runs under `tsx`; it never loads providers, creates a
 * container, resolves a constructor, or starts a transport.
 *
 * @returns The source composition the listing reads through.
 */
export async function loadCapabilityComposition(): Promise<ICapabilityComposition> {
  const capabilities = await import("../src/capabilities/capabilities");
  const metadata = await import("../src/core/list-capability-metadata");

  return {
    getCapabilityTypes: capabilities.getCapabilityTypes,
    listCapabilityMetadata: metadata.listCapabilityMetadata,
  };
}

/**
 * Loads the capability composition and builds capability metadata rows.
 *
 * The script never creates a container, resolves a constructor, invokes a
 * handler, creates an `McpServer`, or starts a transport.
 *
 * @param options - Optional composition loader override.
 * @returns Capability metadata rows in deterministic type and name order.
 * @throws Error with recovery guidance when loading fails or the listed
 * metadata is invalid.
 */
export async function listCapabilityRows(
  options: IListCapabilitiesOptions = {},
): Promise<readonly ICapabilityMetadataRow[]> {
  const loadModule = options.loadModule ?? loadCapabilityComposition;
  let composition: ICapabilityComposition;

  try {
    composition = await loadModule();
  } catch (error) {
    throw new Error(formatLoadFailure(error), { cause: error });
  }

  try {
    const capabilityTypes = composition.getCapabilityTypes();

    return composition.listCapabilityMetadata(capabilityTypes);
  } catch (error) {
    throw new Error(formatMetadataFailure(error), { cause: error });
  }
}

/**
 * Renders capability metadata rows to an output sink.
 *
 * @param rows - Metadata rows to render.
 * @param output - Row sink; defaults to the console.
 */
export function renderCapabilityRows(rows: readonly ICapabilityMetadataRow[], output: IRowsSink = console): void {
  if (rows.length === 0) {
    output.log(EMPTY_CAPABILITIES_MESSAGE);

    return;
  }

  output.table(rows);
}

/**
 * Runs the listing command and reports failures on stderr.
 *
 * @param options - Optional composition loader and output overrides.
 * @returns Process exit code: zero on success, nonzero on any failure.
 */
export async function runListCapabilities(options: IListCapabilitiesOptions = {}): Promise<number> {
  const output = options.output ?? console;
  const errorOutput = options.errorOutput ?? process.stderr;

  try {
    const rows = await listCapabilityRows(options);

    renderCapabilityRows(rows, output);

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    errorOutput.write(`${message}\n`);

    return 1;
  }
}

const cliEntry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;

if (cliEntry === import.meta.url) {
  runListCapabilities().then((exitCode) => {
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  });
}
