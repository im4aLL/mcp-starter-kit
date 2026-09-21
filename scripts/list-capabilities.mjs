import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const BUILT_LISTING_ENTRY = resolve(SCRIPT_DIRECTORY, "..", "dist", "list-capabilities.js");
const REBUILD_COMMAND = "npm run build";
const EXPECTED_EXPORTS = ["getCapabilityTypes", "listCapabilityMetadata"];
const EMPTY_CAPABILITIES_MESSAGE =
  "No capability constructors are registered. Add one to getCapabilityTypes() in src/capabilities/capabilities.ts.";

/**
 * Formats a missing or unloadable built composition error.
 *
 * @param entryPath - Absolute path to the built listing entry.
 * @param error - Import failure raised while loading the entry.
 * @returns A multi-line, actionable error message.
 */
function formatLoadFailure(entryPath, error) {
  const reason = error instanceof Error ? error.message : String(error);

  return [
    `Failed to load the built capability composition from ${entryPath}.`,
    reason,
    `Run "${REBUILD_COMMAND}" to rebuild the capability listing output, then retry.`,
  ].join("\n");
}

/**
 * Formats a built composition that predates the listing API.
 *
 * @param entryPath - Absolute path to the built listing entry.
 * @param missingExports - Export names the loaded module did not provide.
 * @returns A multi-line, actionable error message.
 */
function formatIncompatibleBuildFailure(entryPath, missingExports) {
  return [
    `The built capability composition at ${entryPath} is missing expected exports: ${missingExports.join(", ")}.`,
    `Run "${REBUILD_COMMAND}" to rebuild the listing output, then retry.`,
  ].join("\n");
}

/**
 * Formats a decorator metadata validation failure.
 *
 * @param error - Validation error raised while reading listed metadata.
 * @returns A multi-line, actionable error message.
 */
function formatMetadataFailure(error) {
  const reason = error instanceof Error ? error.message : String(error);

  return [
    "Capability metadata listing failed.",
    reason,
    `Fix the listed constructors in src/capabilities/capabilities.ts, then run "${REBUILD_COMMAND}" and retry.`,
  ].join("\n");
}

/**
 * Imports the built capability composition module.
 *
 * A failed import covers both a missing build and a module-load failure such as
 * a class that carries multiple capability decorators. The caller adds the
 * recovery guidance.
 *
 * @param entryPath - Absolute path to the built listing entry.
 * @returns The loaded composition module namespace.
 */
export async function loadCapabilityComposition(entryPath = BUILT_LISTING_ENTRY) {
  return import(pathToFileURL(entryPath).href);
}

/**
 * Asserts that a loaded composition exposes the listing API.
 *
 * @param composition - Loaded composition module namespace.
 * @param entryPath - Absolute path to the built listing entry.
 * @throws Error when an expected export is missing.
 */
export function assertCompositionExports(composition, entryPath = BUILT_LISTING_ENTRY) {
  const missingExports = EXPECTED_EXPORTS.filter((name) => typeof composition?.[name] !== "function");

  if (missingExports.length > 0) {
    throw new Error(formatIncompatibleBuildFailure(entryPath, missingExports));
  }
}

/**
 * Loads the built composition and builds capability metadata rows.
 *
 * The script never creates a container, resolves a constructor, invokes a
 * handler, creates an `McpServer`, or starts a transport.
 *
 * @param options - Optional entry path and module loader overrides.
 * @returns Capability metadata rows in deterministic type and name order.
 * @throws Error with recovery guidance when the build is missing, stale, or the
 * listed metadata is invalid.
 */
export async function listCapabilityRows(options = {}) {
  const entryPath = options.entryPath ?? BUILT_LISTING_ENTRY;
  const loadModule = options.loadModule ?? loadCapabilityComposition;
  let composition;

  try {
    composition = await loadModule(entryPath);
  } catch (error) {
    throw new Error(formatLoadFailure(entryPath, error), { cause: error });
  }

  assertCompositionExports(composition, entryPath);

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
 * @param output - Output sink; defaults to the console.
 */
export function renderCapabilityRows(rows, output = console) {
  if (rows.length === 0) {
    output.log(EMPTY_CAPABILITIES_MESSAGE);

    return;
  }

  output.table(rows);
}

/**
 * Runs the listing command and reports failures on stderr.
 *
 * @param options - Optional entry path, module loader, and output overrides.
 * @returns Process exit code: zero on success, nonzero on any failure.
 */
export async function runListCapabilities(options = {}) {
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
