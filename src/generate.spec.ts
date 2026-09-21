import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "..");
const generateScript = resolve(repoRoot, "scripts/generate.mjs");
const generateModuleUrl = pathToFileURL(generateScript).href;

const createdFixtures: string[] = [];

afterEach(() => {
  for (const fixture of createdFixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe("generate script", () => {
  it("creates a four-file tool scaffold with the -tool suffix", () => {
    const fixture = createFixture();
    const result = runGenerate(fixture, ["tool", "multiply"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(listRelativeFiles(fixture)).toEqual([
      "src/tools/multiply-tool/multiply-tool.schemas.ts",
      "src/tools/multiply-tool/multiply-tool.spec.ts",
      "src/tools/multiply-tool/multiply-tool.ts",
      "src/tools/multiply-tool/multiply-tool.types.ts",
    ]);

    const toolSource = readFileSync(join(fixture, "src/tools/multiply-tool/multiply-tool.ts"), "utf8");

    expect(toolSource).toContain("export class MultiplyTool implements IMcpToolHandler");
    expect(toolSource).toContain('name: "multiply"');
    expect(toolSource).toContain("@tool(");
    expect(toolSource).not.toContain("@injectable");
    expect(toolSource).toContain("MultiplyToolInputType");
    expect(existsSync(join(fixture, "src/capabilities/capabilities.ts"))).toBe(false);
  });

  it("creates a four-file resource scaffold with the -resource suffix", () => {
    const fixture = createFixture();
    const result = runGenerate(fixture, ["resource", "status"]);

    expect(result.status).toBe(0);
    expect(listRelativeFiles(fixture)).toEqual([
      "src/resources/status-resource/status-resource.schemas.ts",
      "src/resources/status-resource/status-resource.spec.ts",
      "src/resources/status-resource/status-resource.ts",
      "src/resources/status-resource/status-resource.types.ts",
    ]);

    const resourceSource = readFileSync(join(fixture, "src/resources/status-resource/status-resource.ts"), "utf8");

    expect(resourceSource).toContain("export class StatusResource implements IMcpResourceHandler");
    expect(resourceSource).toContain('uri: "status://info"');
    expect(resourceSource).toContain("@resource(");
    expect(resourceSource).not.toContain("@injectable");
  });

  it("creates a four-file prompt scaffold with the -prompt suffix", () => {
    const fixture = createFixture();
    const result = runGenerate(fixture, ["prompt", "greet"]);

    expect(result.status).toBe(0);
    expect(listRelativeFiles(fixture)).toEqual([
      "src/prompts/greet-prompt/greet-prompt.schemas.ts",
      "src/prompts/greet-prompt/greet-prompt.spec.ts",
      "src/prompts/greet-prompt/greet-prompt.ts",
      "src/prompts/greet-prompt/greet-prompt.types.ts",
    ]);

    const promptSource = readFileSync(join(fixture, "src/prompts/greet-prompt/greet-prompt.ts"), "utf8");

    expect(promptSource).toContain("export class GreetPrompt implements IMcpPromptHandler");
    expect(promptSource).toContain('name: "greet"');
    expect(promptSource).toContain("@prompt(");
    expect(promptSource).not.toContain("@injectable");
  });

  it("creates a two-file injectable service scaffold with the -service suffix", () => {
    const fixture = createFixture();
    const result = runGenerate(fixture, ["service", "inventory"]);

    expect(result.status).toBe(0);
    expect(listRelativeFiles(fixture)).toEqual([
      "src/services/inventory-service.spec.ts",
      "src/services/inventory-service.ts",
    ]);

    const serviceSource = readFileSync(join(fixture, "src/services/inventory-service.ts"), "utf8");

    expect(serviceSource).toContain("@injectable()");
    expect(serviceSource).toContain("export class InventoryService");
    expect(serviceSource).not.toContain("@tool");
    expect(serviceSource).not.toContain("@resource");
    expect(serviceSource).not.toContain("@prompt");
    expect(existsSync(join(fixture, "src/providers.ts"))).toBe(false);
  });

  it("does not modify constructor registration or provider configuration files", () => {
    const fixture = createFixture();
    const capabilitiesPath = join(fixture, "src/capabilities/capabilities.ts");
    const providersPath = join(fixture, "src/providers.ts");

    mkdirSync(dirname(capabilitiesPath), { recursive: true });
    writeFileSync(capabilitiesPath, "export const untouchedCapabilities = true;\n");
    writeFileSync(providersPath, "export const untouchedProviders = true;\n");

    const result = runGenerate(fixture, ["tool", "multiply"]);

    expect(result.status).toBe(0);
    expect(readFileSync(capabilitiesPath, "utf8")).toBe("export const untouchedCapabilities = true;\n");
    expect(readFileSync(providersPath, "utf8")).toBe("export const untouchedProviders = true;\n");
  });

  it("refuses to overwrite an existing target and leaves other planned files unwritten", () => {
    const fixture = createFixture();
    const existingPath = join(fixture, "src/tools/multiply-tool/multiply-tool.ts");

    mkdirSync(dirname(existingPath), { recursive: true });
    writeFileSync(existingPath, "export const existing = true;\n");

    const result = runGenerate(fixture, ["tool", "multiply"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to overwrite existing file");
    expect(result.stderr).toContain("src/tools/multiply-tool/multiply-tool.ts");
    expect(listRelativeFiles(fixture)).toEqual(["src/tools/multiply-tool/multiply-tool.ts"]);
    expect(readFileSync(existingPath, "utf8")).toBe("export const existing = true;\n");
  });

  it("rolls back files and directories created before a write failure", () => {
    const fixture = createFixture();
    const result = runInjectedGenerate(fixture, "tool", "partial", 2);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Simulated write failure.");
    expect(existsSync(join(fixture, "src"))).toBe(false);
    expect(listRelativeFiles(fixture)).toEqual([]);
  });

  it("fails for an unsupported kind without writing files", () => {
    const fixture = createFixture();
    const result = runGenerate(fixture, ["widget", "multiply"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unsupported kind "widget"');
    expect(listRelativeFiles(fixture)).toEqual([]);
  });

  it("rejects an unsupported kind when generateScaffold is called directly", async () => {
    const fixture = createFixture();
    const { generateScaffold } = await import(generateModuleUrl);

    await expect(generateScaffold("widget", "multiply", { cwd: fixture })).rejects.toThrow('Unsupported kind "widget"');
    expect(listRelativeFiles(fixture)).toEqual([]);
  });

  it("fails for missing arguments, extra arguments, and unsafe names", () => {
    const fixture = createFixture();

    expect(runGenerate(fixture, []).status).not.toBe(0);
    expect(runGenerate(fixture, []).stderr).toContain("Missing kind and name");
    expect(runGenerate(fixture, ["tool"]).stderr).toContain("Missing name");
    expect(runGenerate(fixture, ["tool", "multiply", "extra"]).stderr).toContain("Unexpected extra arguments");
    expect(runGenerate(fixture, ["tool", "Multiply"]).stderr).toContain("Invalid name");
    expect(runGenerate(fixture, ["tool", "multiply_tool"]).stderr).toContain("Invalid name");
    expect(runGenerate(fixture, ["tool", "../secret"]).stderr).toContain("Unsafe name");
    expect(runGenerate(fixture, ["tool", "multiply-tool"]).stderr).toContain("already ends with -tool");
    expect(listRelativeFiles(fixture)).toEqual([]);
  });

  it("does not change the runtime add tool sample when generation collides", () => {
    const addToolPath = join(repoRoot, "src/tools/add-tool/add-tool.ts");
    const before = readFileSync(addToolPath, "utf8");
    const result = runGenerate(repoRoot, ["tool", "add"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to overwrite existing file");
    expect(readFileSync(addToolPath, "utf8")).toBe(before);
  });
});

/**
 * Creates an empty temporary project directory for generation.
 *
 * @returns Absolute fixture path.
 */
function createFixture(): string {
  const fixture = mkdtempSync(join(tmpdir(), "mcp-generate-"));
  createdFixtures.push(fixture);

  return fixture;
}

/**
 * Runs the public generate CLI against a working directory.
 *
 * @param cwd - Generation root.
 * @param args - Kind and name arguments.
 * @returns Process status and stdio text.
 */
function runGenerate(cwd: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [generateScript, ...args], {
    cwd,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Runs generateScaffold with a write that fails after a successful file.
 *
 * @param cwd - Generation root.
 * @param kind - Scaffold kind.
 * @param name - Kebab-case base name.
 * @param failOnWrite - 1-based write index that should throw.
 * @returns Process status and stdio text.
 */
function runInjectedGenerate(
  cwd: string,
  kind: string,
  name: string,
  failOnWrite: number,
): { status: number | null; stdout: string; stderr: string } {
  const source = `
    import { mkdir, rm, stat, writeFile } from "node:fs/promises";
    import { generateScaffold } from ${JSON.stringify(generateModuleUrl)};

    let writes = 0;
    const realWriteFile = writeFile;

    try {
      await generateScaffold(${JSON.stringify(kind)}, ${JSON.stringify(name)}, {
        cwd: ${JSON.stringify(cwd)},
        io: {
          mkdir,
          rm,
          stat,
          writeFile: async (path, contents, options) => {
            writes += 1;

            if (writes === ${failOnWrite}) {
              throw new Error("Simulated write failure.");
            }

            return realWriteFile(path, contents, options);
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(message + "\\n");
      process.exit(1);
    }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

/**
 * Lists generated files under a fixture, ignoring empty directories.
 *
 * @param root - Fixture directory.
 * @returns POSIX-relative file paths in sorted order.
 */
function listRelativeFiles(root: string): string[] {
  const files: string[] = [];

  collectFiles(root, root, files);
  files.sort();

  return files;
}

/**
 * Recursively collects file paths under a directory.
 *
 * @param root - Fixture directory.
 * @param current - Directory being walked.
 * @param files - Collector for relative paths.
 */
function collectFiles(root: string, current: string, files: string[]): void {
  if (!existsSync(current)) {
    return;
  }

  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolutePath = join(current, entry.name);

    if (entry.isDirectory()) {
      collectFiles(root, absolutePath, files);
      continue;
    }

    files.push(
      absolutePath
        .slice(root.length + 1)
        .split("\\")
        .join("/"),
    );
  }
}
