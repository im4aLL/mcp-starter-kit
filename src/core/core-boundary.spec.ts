import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const coreDirectory = dirname(fileURLToPath(import.meta.url));
const srcDirectory = resolve(coreDirectory, "..");
const forbiddenDirectories = ["resources", "tools", "services", "capabilities"];
const forbiddenFiles = ["providers", "config"];

/**
 * Recursively collects TypeScript files under a directory.
 *
 * @param directory - Directory to scan.
 * @returns Absolute paths of every `.ts` file below the directory.
 */
function collectTypescriptFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTypescriptFiles(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Extracts every module specifier referenced by static imports, re-exports,
 * dynamic imports, and CommonJS requires.
 *
 * @param source - TypeScript source text to scan.
 * @returns The raw module specifiers in source order.
 */
function extractImportSpecifiers(source: string): string[] {
  const pattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/g;
  const specifiers: string[] = [];

  for (const match of source.matchAll(pattern)) {
    const specifier = match[1];

    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

/**
 * Removes a TypeScript or JavaScript module extension from a path.
 *
 * @param pathValue - Candidate path.
 * @returns The path without a recognized module extension.
 */
function stripModuleExtension(pathValue: string): string {
  return pathValue.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, "");
}

/**
 * Reports whether a resolved path targets an application-owned module.
 *
 * @param candidatePath - Absolute candidate path.
 * @returns Whether the path is under a forbidden directory or names a forbidden file.
 */
function isForbiddenPath(candidatePath: string): boolean {
  const normalized = stripModuleExtension(candidatePath);

  for (const directory of forbiddenDirectories) {
    const root = join(srcDirectory, directory);

    if (normalized === root || normalized.startsWith(`${root}${sep}`)) {
      return true;
    }
  }

  for (const fileName of forbiddenFiles) {
    if (normalized === join(srcDirectory, fileName)) {
      return true;
    }
  }

  return false;
}

describe("core module boundary", () => {
  it("never imports application-owned modules", () => {
    const offenders: string[] = [];

    for (const filePath of collectTypescriptFiles(coreDirectory)) {
      const source = readFileSync(filePath, "utf8");

      for (const specifier of extractImportSpecifiers(source)) {
        if (!specifier.startsWith(".")) {
          continue;
        }

        const resolvedPath = resolve(dirname(filePath), specifier);

        if (isForbiddenPath(resolvedPath)) {
          offenders.push(`${relative(coreDirectory, filePath)} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
