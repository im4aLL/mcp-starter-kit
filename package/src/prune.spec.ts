import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ScaffoldError } from "./errors";
import { pruneTemplate, readStarterkitIgnore } from "./prune";

const createdRoots: string[] = [];

/**
 * Creates an isolated temporary project root for a spec.
 *
 * @returns The absolute temp directory path.
 */
async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "starter-ignore-"));

  createdRoots.push(root);

  return root;
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("readStarterkitIgnore", () => {
  it("returns non-empty, non-comment patterns", async () => {
    const root = await makeRoot();

    await writeFile(join(root, ".starterkitignore"), "# comment\n\npackage/\n dist/\n");

    expect(await readStarterkitIgnore(root, ".starterkitignore")).toEqual(["package/", "dist/"]);
  });

  it("returns an empty list when the file is missing", async () => {
    const root = await makeRoot();

    expect(await readStarterkitIgnore(root, ".starterkitignore")).toEqual([]);
  });

  it("throws a ScaffoldError when the ignore path is a directory", async () => {
    const root = await makeRoot();

    await mkdir(join(root, ".starterkitignore"));

    await expect(readStarterkitIgnore(root, ".starterkitignore")).rejects.toBeInstanceOf(ScaffoldError);
  });
});

describe("pruneTemplate", () => {
  it("removes ignored paths and the ignore file while keeping others", async () => {
    const root = await makeRoot();

    await mkdir(join(root, "package"));
    await writeFile(join(root, "package", "index.ts"), "generated");
    await writeFile(join(root, "keep.txt"), "keep");
    await writeFile(join(root, ".starterkitignore"), "package/\n");

    await pruneTemplate(root, ".starterkitignore");

    await expect(readFile(join(root, "package", "index.ts"))).rejects.toThrow();
    await expect(readFile(join(root, ".starterkitignore"))).rejects.toThrow();
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("keep");
  });

  it("refuses paths that escape the project root", async () => {
    const root = await makeRoot();

    await writeFile(join(root, ".starterkitignore"), "../escape\n");

    await expect(pruneTemplate(root, ".starterkitignore")).rejects.toBeInstanceOf(ScaffoldError);
  });

  it("refuses a pattern that resolves to the project root", async () => {
    const root = await makeRoot();

    await writeFile(join(root, ".starterkitignore"), ".\n");

    await expect(pruneTemplate(root, ".starterkitignore")).rejects.toBeInstanceOf(ScaffoldError);
  });

  it("treats patterns as literal paths rather than globs", async () => {
    const root = await makeRoot();

    await writeFile(join(root, ".starterkitignore"), "*.log\n");
    await writeFile(join(root, "a.log"), "keep");

    await pruneTemplate(root, ".starterkitignore");

    expect(await readFile(join(root, "a.log"), "utf8")).toBe("keep");
  });
});
