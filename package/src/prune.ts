import { readFile, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { ScaffoldError } from "./errors";

/**
 * Reads and parses the starter ignore file into path patterns.
 *
 * Blank lines and `#` comment lines are skipped. A missing file yields no
 * patterns, so pruning is a no-op when the template does not define one.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param fileName - Name of the ignore file at the project root.
 * @returns The trimmed, non-empty patterns in file order.
 * @throws {ScaffoldError} When the ignore file exists but cannot be read.
 */
export async function readStarterkitIgnore(root: string, fileName: string): Promise<string[]> {
  const path = resolve(root, fileName);
  let contents: string;

  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    const detail = error instanceof Error ? error.message : String(error);

    throw new ScaffoldError(`Could not read ${fileName}: ${detail}`);
  }

  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Resolves a pattern to an absolute path that stays inside the project root.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param pattern - Ignore pattern to resolve.
 * @returns The absolute path named by the pattern.
 * @throws {ScaffoldError} When the pattern escapes the project root.
 */
function resolveIgnoreTarget(root: string, pattern: string): string {
  const target = resolve(root, pattern);

  if (target === root || !target.startsWith(root + sep)) {
    throw new ScaffoldError(`Refusing to prune outside the project: ${pattern}`);
  }

  return target;
}

/**
 * Deletes every path named by the starter ignore file and the ignore file itself.
 *
 * @param root - Absolute path of the scaffolded project.
 * @param fileName - Name of the ignore file at the project root.
 * @throws {ScaffoldError} When a pattern escapes the project root.
 */
export async function pruneTemplate(root: string, fileName: string): Promise<void> {
  const patterns = await readStarterkitIgnore(root, fileName);

  for (const pattern of patterns) {
    const target = resolveIgnoreTarget(root, pattern);

    await rm(target, { recursive: true, force: true });
  }

  await rm(resolve(root, fileName), { force: true });
}
