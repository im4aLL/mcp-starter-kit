import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ScaffoldError } from "./errors";
import { applyRename } from "./rename";

const TOKEN_FILES = {
  token: "mcp-starter-kit",
  paths: ["README.md", "src/main.smoke.spec.ts", "src/config.spec.ts", "src/core/capability-metadata.ts"],
};

const createdRoots: string[] = [];

/**
 * Creates a minimal template-shaped project for rename specs.
 *
 * @returns The absolute temp directory path.
 */
async function makeTemplate(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "starter-rename-"));

  createdRoots.push(root);
  await mkdir(join(root, "src", "core"), { recursive: true });

  const packageJson = {
    name: "mcp-starter-kit",
    version: "1.4.0",
    bin: { "mcp-starter-kit": "dist/main.js" },
  };
  const packageLock = {
    name: "mcp-starter-kit",
    version: "1.4.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": {
        name: "mcp-starter-kit",
        version: "1.4.0",
        bin: { "mcp-starter-kit": "dist/main.js" },
      },
    },
  };
  const configTs = [
    "export const serverConfig = {",
    '  name: process.env.MCP_SERVER_NAME ?? "mcp-starter-kit",',
    '  version: process.env.MCP_SERVER_VERSION ?? "1.4.0",',
    "};",
    "",
  ].join("\n");

  await writeFile(join(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(join(root, "package-lock.json"), `${JSON.stringify(packageLock, null, 2)}\n`);
  await writeFile(join(root, "src", "config.ts"), configTs);
  await writeFile(join(root, "README.md"), "# mcp-starter-kit\n");
  await writeFile(join(root, "src", "main.smoke.spec.ts"), 'expect(name).toBe("mcp-starter-kit");\n');
  await writeFile(join(root, "src", "config.spec.ts"), 'expect(serverConfig.name).toBe("mcp-starter-kit");\n');
  await writeFile(
    join(root, "src", "core", "capability-metadata.ts"),
    'export const CAPABILITY_METADATA = Symbol("mcp-starter-kit.capability-metadata");\n',
  );

  return root;
}

/**
 * Reads and parses a JSON file from a scaffolded project.
 *
 * @param path - Absolute path of the JSON file.
 * @returns The parsed JSON object.
 */
async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("applyRename", () => {
  it("patches metadata, lockfile, config defaults, and token references", async () => {
    const root = await makeTemplate();

    await applyRename(root, { name: "cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES);

    const packageJson = await readJson(join(root, "package.json"));
    expect(packageJson.name).toBe("cool-server");
    expect(packageJson.version).toBe("0.1.0");
    expect(packageJson.bin).toEqual({ "cool-server": "dist/main.js" });

    const packageLock = await readJson(join(root, "package-lock.json"));
    expect(packageLock.name).toBe("cool-server");
    expect(packageLock.version).toBe("0.1.0");

    const lockRoot = (packageLock.packages as Record<string, Record<string, unknown>>)[""];
    expect(lockRoot.name).toBe("cool-server");
    expect(lockRoot.version).toBe("0.1.0");
    expect(lockRoot.bin).toEqual({ "cool-server": "dist/main.js" });

    const configTs = await readFile(join(root, "src", "config.ts"), "utf8");
    expect(configTs).toContain('name: process.env.MCP_SERVER_NAME ?? "cool-server"');
    expect(configTs).toContain('version: process.env.MCP_SERVER_VERSION ?? "0.1.0"');

    expect(await readFile(join(root, "README.md"), "utf8")).toBe("# cool-server\n");
    expect(await readFile(join(root, "src", "main.smoke.spec.ts"), "utf8")).toContain('"cool-server"');
    expect(await readFile(join(root, "src", "config.spec.ts"), "utf8")).toContain('"cool-server"');
    expect(await readFile(join(root, "src", "core", "capability-metadata.ts"), "utf8")).toContain(
      'Symbol("cool-server.capability-metadata")',
    );
  });

  it("uses the unscoped name for the bin entry", async () => {
    const root = await makeTemplate();

    await applyRename(root, { name: "@me/cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES);

    const packageJson = await readJson(join(root, "package.json"));
    expect(packageJson.name).toBe("@me/cool-server");
    expect(packageJson.bin).toEqual({ "cool-server": "dist/main.js" });
  });

  it("patches a string bin entry", async () => {
    const root = await makeTemplate();

    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({ name: "mcp-starter-kit", version: "1.4.0", bin: "dist/main.js" }, null, 2)}\n`,
    );

    await applyRename(root, { name: "cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES);

    const packageJson = await readJson(join(root, "package.json"));
    expect(packageJson.bin).toEqual({ "cool-server": "dist/main.js" });
  });

  it("preserves secondary bin entries while renaming the template key", async () => {
    const root = await makeTemplate();

    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "mcp-starter-kit",
          version: "1.4.0",
          bin: { "mcp-starter-kit": "dist/main.js", helper: "dist/helper.js" },
        },
        null,
        2,
      )}\n`,
    );

    await applyRename(root, { name: "cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES);

    const packageJson = await readJson(join(root, "package.json"));
    expect(packageJson.bin).toEqual({ "cool-server": "dist/main.js", helper: "dist/helper.js" });
  });

  it("succeeds when package-lock.json is absent", async () => {
    const root = await makeTemplate();

    await rm(join(root, "package-lock.json"));

    await applyRename(root, { name: "cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES);

    const packageJson = await readJson(join(root, "package.json"));
    expect(packageJson.name).toBe("cool-server");
    await expect(readFile(join(root, "package-lock.json"), "utf8")).rejects.toThrow();
  });

  it("fails when the server config shape is unexpected", async () => {
    const root = await makeTemplate();

    await writeFile(join(root, "src", "config.ts"), "export const serverConfig = {};\n");

    await expect(
      applyRename(root, { name: "cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES),
    ).rejects.toBeInstanceOf(ScaffoldError);
  });

  it("fails with a ScaffoldError when src/config.ts is missing", async () => {
    const root = await makeTemplate();

    await rm(join(root, "src", "config.ts"));

    await expect(
      applyRename(root, { name: "cool-server", binName: "cool-server", version: "0.1.0" }, TOKEN_FILES),
    ).rejects.toThrow("Could not patch src/config.ts");
  });
});
