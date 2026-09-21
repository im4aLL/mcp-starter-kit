import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ICliRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const distEntry = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const packageJsonUrl = new URL("../package.json", import.meta.url);
const { version } = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version: string };

/**
 * Runs the built CLI entry point and captures its result.
 *
 * @param args - Arguments passed to the built CLI.
 * @returns The exit code and captured output streams.
 */
function runBuiltCli(args: string[]): Promise<ICliRunResult> {
  return new Promise((resolve) => {
    execFile("node", [distEntry, ...args], (error, stdout, stderr) => {
      let code = 0;

      if (error !== null) {
        code = typeof error.code === "number" ? error.code : 1;
      }

      resolve({ code, stdout, stderr });
    });
  });
}

describe("built CLI entry point", () => {
  it("has a built dist/main.js entry point", () => {
    expect(existsSync(distEntry)).toBe(true);
  });

  it("prints usage for --help and exits 0", async () => {
    const result = await runBuiltCli(["--help"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage: create-mcp-starter-kit");
  });

  it("prints the package version for --version and exits 0", async () => {
    const result = await runBuiltCli(["--version"]);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });
});
