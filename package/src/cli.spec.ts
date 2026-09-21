import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runCli } from "./cli";
import type { ICliDependencies } from "./cli.types";
import { ScaffoldError } from "./errors";

interface ITestDependencies {
  dependencies: ICliDependencies;
  calls: string[];
}

const createdRoots: string[] = [];
let stdout = "";
let stderr = "";

/**
 * Creates an isolated temporary working directory for a spec.
 *
 * @returns The absolute temp directory path.
 */
async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "starter-cli-"));

  createdRoots.push(root);

  return root;
}

/**
 * Builds injected CLI dependencies that record their call order.
 *
 * @param overrides - Collaborators to replace for a specific spec.
 * @returns The dependency set and the recorded call order.
 */
function makeDependencies(overrides: Partial<ICliDependencies> = {}): ITestDependencies {
  const calls: string[] = [];
  const dependencies: ICliDependencies = {
    resolveTemplateTag: vi.fn(async () => {
      calls.push("resolveTemplateTag");

      return "v0.1.0";
    }),
    cloneTemplate: vi.fn(async () => {
      calls.push("cloneTemplate");
    }),
    pruneTemplate: vi.fn(async () => {
      calls.push("pruneTemplate");
    }),
    applyRename: vi.fn(async () => {
      calls.push("applyRename");
    }),
    initRepository: vi.fn(async () => {
      calls.push("initRepository");

      return true;
    }),
    promptForName: vi.fn(async () => "prompted-name"),
    ...overrides,
  };

  return { dependencies, calls };
}

/**
 * Overrides whether stdin reports itself as a TTY.
 *
 * @param value - Value to assign to `process.stdin.isTTY`.
 * @returns A callback that restores the previous state.
 */
function stubStdinIsTTY(value: boolean): () => void {
  const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

  Object.defineProperty(process.stdin, "isTTY", { value, configurable: true });

  return () => {
    if (original === undefined) {
      delete (process.stdin as { isTTY?: boolean }).isTTY;

      return;
    }

    Object.defineProperty(process.stdin, "isTTY", original);
  };
}

beforeEach(() => {
  stdout = "";
  stderr = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout += String(chunk);

    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr += String(chunk);

    return true;
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("runCli", () => {
  it("prints usage and returns 0 for --help", async () => {
    const cwd = await makeWorkspace();
    const { dependencies, calls } = makeDependencies();

    const code = await runCli(["--help"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(0);
    expect(stdout).toContain("Usage: create-mcp-starter-kit");
    expect(calls).toEqual([]);
  });

  it("prints the CLI version and returns 0 for --version", async () => {
    const cwd = await makeWorkspace();
    const { dependencies } = makeDependencies();

    const code = await runCli(["--version"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(0);
    expect(stdout).toContain("9.9.9");
  });

  it("rejects a non-empty target directory", async () => {
    const cwd = await makeWorkspace();

    await mkdir(join(cwd, "my-server"));
    await writeFile(join(cwd, "my-server", "file.txt"), "x");

    const { dependencies, calls } = makeDependencies();

    const code = await runCli(["my-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(1);
    expect(stderr).toContain("not empty");
    expect(calls).toEqual([]);
  });

  it("rejects a target path that is a file", async () => {
    const cwd = await makeWorkspace();

    await writeFile(join(cwd, "my-server"), "x");

    const { dependencies } = makeDependencies();

    const code = await runCli(["my-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(1);
    expect(stderr).toContain("is not a directory");
  });

  it("runs the scaffold flow and prints next steps", async () => {
    const cwd = await makeWorkspace();
    const { dependencies, calls } = makeDependencies();

    const code = await runCli(["my-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(0);
    expect(calls).toEqual(["resolveTemplateTag", "cloneTemplate", "pruneTemplate", "applyRename", "initRepository"]);
    expect(stdout).toContain("Created my-server.");
    expect(stdout).toContain("cd my-server");
  });

  it("removes the cloned directory when rename fails", async () => {
    const cwd = await makeWorkspace();
    const { dependencies } = makeDependencies({
      cloneTemplate: async (_repository, _tag, targetDir) => {
        await mkdir(targetDir, { recursive: true });
      },
      applyRename: async () => {
        throw new ScaffoldError("rename failed");
      },
    });

    const code = await runCli(["my-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(1);
    expect(stderr).toContain("rename failed");
    await expect(stat(join(cwd, "my-server"))).rejects.toThrow();
  });

  it("fails when the template tag cannot be resolved", async () => {
    const cwd = await makeWorkspace();
    const { dependencies } = makeDependencies({
      resolveTemplateTag: async () => {
        throw new ScaffoldError("Template tag not found.");
      },
    });

    const code = await runCli(["my-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(1);
    expect(stderr).toContain("Template tag not found.");
  });

  it("scaffolds a scoped name into the unscoped directory", async () => {
    const cwd = await makeWorkspace();
    let clonedTarget = "";
    const { dependencies } = makeDependencies({
      cloneTemplate: async (_repository, _tag, targetDir) => {
        clonedTarget = targetDir;
      },
    });

    const code = await runCli(["@me/cool-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(0);
    expect(basename(clonedTarget)).toBe("cool-server");
    expect(clonedTarget).toBe(join(cwd, "cool-server"));
    expect(stdout).toContain("cd cool-server");
  });

  it("warns but succeeds when git init fails", async () => {
    const cwd = await makeWorkspace();
    const { dependencies } = makeDependencies({
      initRepository: async () => false,
    });

    const code = await runCli(["my-server"], { cwd, cliVersion: "9.9.9" }, dependencies);

    expect(code).toBe(0);
    expect(stderr).toContain("git init failed");
  });

  it("fails without prompting when no name is given and stdin is not a TTY", async () => {
    const cwd = await makeWorkspace();
    const { dependencies } = makeDependencies();
    const restore = stubStdinIsTTY(false);

    try {
      const code = await runCli([], { cwd, cliVersion: "9.9.9" }, dependencies);

      expect(code).toBe(1);
      expect(stderr).toContain("A project name is required");
      expect(vi.mocked(dependencies.promptForName)).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("fails when the prompted name is whitespace only", async () => {
    const cwd = await makeWorkspace();
    const { dependencies } = makeDependencies({
      promptForName: vi.fn(async () => "   "),
    });
    const restore = stubStdinIsTTY(true);

    try {
      const code = await runCli([], { cwd, cliVersion: "9.9.9" }, dependencies);

      expect(code).toBe(1);
      expect(stderr).toContain("Project name cannot be empty");
      expect(vi.mocked(dependencies.promptForName)).toHaveBeenCalledOnce();
    } finally {
      restore();
    }
  });
});
