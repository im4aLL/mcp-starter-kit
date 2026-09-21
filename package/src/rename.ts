import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { IRenameFiles, IRenameInput } from "./cli.types";
import { ScaffoldError } from "./errors";

const SERVER_NAME_PATTERN = /(name:\s*process\.env\.MCP_SERVER_NAME\s*\?\?\s*)"[^"]*"/;
const SERVER_VERSION_PATTERN = /(version:\s*process\.env\.MCP_SERVER_VERSION\s*\?\?\s*)"[^"]*"/;
const DEFAULT_BIN_TARGET = "dist/main.js";

/**
 * Checks whether an unknown thrown value represents a missing file.
 *
 * @param error - Error thrown by a file operation.
 * @returns `true` when the error code is `ENOENT`.
 */
function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Describes an unknown thrown value for error messages.
 *
 * @param error - Error thrown by a file operation.
 * @returns The error message or a stringified value.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Builds the new bin map while renaming the template entry.
 *
 * A string bin maps directly to the new name. When the template key is present
 * in an object bin it is renamed and every other entry is preserved; otherwise
 * the first existing target is reused.
 *
 * @param bin - Existing `bin` value from a package manifest.
 * @param binName - Executable name for the new project.
 * @param token - Template name token used as the original bin key.
 * @returns The rewritten bin map.
 */
function patchBin(bin: unknown, binName: string, token: string): Record<string, string> {
  if (typeof bin === "string") {
    return { [binName]: bin };
  }

  if (bin !== null && typeof bin === "object" && !Array.isArray(bin)) {
    const entries = bin as Record<string, string>;
    const templateTarget = entries[token];

    if (templateTarget !== undefined) {
      const renamed: Record<string, string> = { [binName]: templateTarget };

      for (const [key, value] of Object.entries(entries)) {
        if (key !== token) {
          renamed[key] = value;
        }
      }

      return renamed;
    }

    const [firstTarget] = Object.values(entries);

    return { [binName]: firstTarget ?? DEFAULT_BIN_TARGET };
  }

  return { [binName]: DEFAULT_BIN_TARGET };
}

/**
 * Patches `package.json` name, version, and bin entry for the new project.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param input - Rename values to apply.
 * @param token - Template name token used as the original bin key.
 * @throws {ScaffoldError} When package.json cannot be read, parsed, or written.
 */
async function patchPackageJson(root: string, input: IRenameInput, token: string): Promise<void> {
  const path = resolve(root, "package.json");
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new ScaffoldError(`Could not patch package.json: ${describeError(error)}`);
  }

  parsed.name = input.name;
  parsed.version = input.version;
  parsed.bin = patchBin(parsed.bin, input.binName, token);

  try {
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  } catch (error) {
    throw new ScaffoldError(`Could not patch package.json: ${describeError(error)}`);
  }
}

/**
 * Patches `package-lock.json` name, version, and bin entry when the lockfile exists.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param input - Rename values to apply.
 * @param token - Template name token used as the original bin key.
 * @throws {ScaffoldError} When an existing lockfile cannot be read, parsed, or written.
 */
async function patchPackageLock(root: string, input: IRenameInput, token: string): Promise<void> {
  const path = resolve(root, "package-lock.json");
  let contents: string;

  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return;
    }

    throw new ScaffoldError(`Could not patch package-lock.json: ${describeError(error)}`);
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(contents) as Record<string, unknown>;
  } catch (error) {
    throw new ScaffoldError(`Could not patch package-lock.json: ${describeError(error)}`);
  }

  parsed.name = input.name;
  parsed.version = input.version;

  const packages = parsed.packages;
  const rootPackage =
    packages !== null && typeof packages === "object" && !Array.isArray(packages)
      ? (packages as Record<string, unknown>)[""]
      : undefined;

  if (rootPackage !== null && typeof rootPackage === "object" && !Array.isArray(rootPackage)) {
    const record = rootPackage as Record<string, unknown>;

    record.name = input.name;
    record.version = input.version;
    record.bin = patchBin(record.bin, input.binName, token);
  }

  try {
    await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`);
  } catch (error) {
    throw new ScaffoldError(`Could not patch package-lock.json: ${describeError(error)}`);
  }
}

/**
 * Patches the server identity defaults in `src/config.ts`.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param input - Rename values to apply.
 * @throws {ScaffoldError} When the expected server config shape is absent.
 */
async function patchServerConfig(root: string, input: IRenameInput): Promise<void> {
  const path = resolve(root, "src/config.ts");
  let original: string;

  try {
    original = await readFile(path, "utf8");
  } catch (error) {
    throw new ScaffoldError(`Could not patch src/config.ts: ${describeError(error)}`);
  }

  if (!SERVER_NAME_PATTERN.test(original) || !SERVER_VERSION_PATTERN.test(original)) {
    throw new ScaffoldError("Could not patch src/config.ts; the template layout may have changed.");
  }

  const renamed = original
    .replace(SERVER_NAME_PATTERN, `$1"${input.name}"`)
    .replace(SERVER_VERSION_PATTERN, `$1"${input.version}"`);

  await writeFile(path, renamed);
}

/**
 * Replaces the template name token within the given text files.
 *
 * Missing files are ignored so the rename survives template layout changes.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param files - Token and relative paths to rewrite.
 * @param name - Replacement project name.
 */
async function replaceTokenInFiles(root: string, files: IRenameFiles, name: string): Promise<void> {
  for (const file of files.paths) {
    const path = resolve(root, file);
    let contents: string;

    try {
      contents = await readFile(path, "utf8");
    } catch {
      continue;
    }

    if (!contents.includes(files.token)) {
      continue;
    }

    await writeFile(path, contents.split(files.token).join(name));
  }
}

/**
 * Applies the project rename across metadata, lockfile, server config, and template references.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param input - Rename values to apply.
 * @param files - Token replacement targets for the template name token.
 */
export async function applyRename(root: string, input: IRenameInput, files: IRenameFiles): Promise<void> {
  await patchPackageJson(root, input, files.token);
  await patchPackageLock(root, input, files.token);
  await patchServerConfig(root, input);
  await replaceTokenInFiles(root, files, input.name);
}
