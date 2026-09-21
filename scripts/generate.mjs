import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SUPPORTED_KINDS = ["tool", "resource", "prompt", "service"];
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Throws when a scaffold kind is not supported.
 *
 * @param kind - Scaffold kind.
 */
function assertSupportedKind(kind) {
  if (!SUPPORTED_KINDS.includes(kind)) {
    throw new Error(`Unsupported kind "${kind}". Use tool, resource, prompt, or service.`);
  }
}

/**
 * Validates a scaffold kind and kebab-case base name.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case base name.
 */
function validateKindAndName(kind, name) {
  assertSupportedKind(kind);

  if (name.includes("\0") || name.includes("/") || name.includes("\\") || name.includes("..") || name.includes(sep)) {
    throw new Error(
      `Unsafe name "${name}". Use a kebab-case base name such as multiply, without path separators or parent segments.`,
    );
  }

  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid name "${name}". Use a kebab-case base name such as multiply or project-info (lowercase letters, digits, and single hyphens).`,
    );
  }

  if (name.endsWith(`-${kind}`)) {
    const baseName = name.slice(0, -(kind.length + 1));

    throw new Error(
      `Name "${name}" already ends with -${kind}. Use the kebab-case base name, for example ${baseName || "multiply"}.`,
    );
  }
}

/**
 * Parses CLI arguments for the scaffold generator.
 *
 * @param argv - Arguments after the script path.
 * @returns The requested kind and kebab-case base name.
 */
export function parseGenerateArgs(argv) {
  if (argv.length === 0) {
    throw new Error(
      "Missing kind and name. Use npm run generate <tool|resource|prompt|service> <name>, for example npm run generate tool multiply.",
    );
  }

  if (argv.length === 1) {
    assertSupportedKind(argv[0]);

    throw new Error(
      `Missing name. Use npm run generate ${argv[0]} <name>, for example npm run generate ${argv[0]} multiply.`,
    );
  }

  if (argv.length > 2) {
    throw new Error(
      `Unexpected extra arguments: ${argv.slice(2).join(" ")}. Use npm run generate <tool|resource|prompt|service> <name>.`,
    );
  }

  const [kind, name] = argv;

  validateKindAndName(kind, name);

  return { kind, name };
}

/**
 * Plans output paths and file contents for one scaffold.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case base name.
 * @param cwd - Directory that contains `src/`.
 * @returns Relative paths, absolute paths, and file contents.
 */
export function planScaffold(kind, name, cwd) {
  validateKindAndName(kind, name);

  const pascal = toPascalCase(name);
  const mcpName = name.replaceAll("-", "_");
  const title = toTitleCase(name);
  const fileBase = `${name}-${kind}`;
  const className = `${pascal}${toPascalCase(kind)}`;

  if (kind === "service") {
    const relativePaths = [`src/services/${fileBase}.ts`, `src/services/${fileBase}.spec.ts`];

    return {
      kind,
      name,
      className,
      files: [
        {
          relativePath: relativePaths[0],
          absolutePath: resolve(cwd, relativePaths[0]),
          contents: renderService(className, name),
        },
        {
          relativePath: relativePaths[1],
          absolutePath: resolve(cwd, relativePaths[1]),
          contents: renderServiceSpec(className, fileBase, name),
        },
      ],
    };
  }

  const directory = join("src", `${kind}s`, fileBase);
  const relativePaths = [
    join(directory, `${fileBase}.ts`),
    join(directory, `${fileBase}.schemas.ts`),
    join(directory, `${fileBase}.types.ts`),
    join(directory, `${fileBase}.spec.ts`),
  ];
  const contents = capabilityContents(kind, className, fileBase, mcpName, name, title);

  return {
    kind,
    name,
    className,
    files: relativePaths.map((relativePath, index) => ({
      relativePath: relativePath.split(sep).join("/"),
      absolutePath: resolve(cwd, relativePath),
      contents: contents[index],
    })),
  };
}

/**
 * Generates one capability or service scaffold without overwriting files.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case base name.
 * @param options - Working directory and optional filesystem overrides.
 * @returns Relative paths that were written.
 */
export async function generateScaffold(kind, name, options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const io = {
    mkdir: options.io?.mkdir ?? mkdir,
    rm: options.io?.rm ?? rm,
    stat: options.io?.stat ?? stat,
    writeFile: options.io?.writeFile ?? writeFile,
  };
  const plan = planScaffold(kind, name, cwd);

  assertSafePaths(cwd, plan.files);
  await assertTargetsAreFree(plan.files, io);

  const createdFiles = [];
  const createdDirectories = await collectMissingDirectories(plan.files, io);

  try {
    for (const directoryPath of createdDirectories) {
      await io.mkdir(directoryPath, { recursive: true });
    }

    for (const file of plan.files) {
      await io.writeFile(file.absolutePath, file.contents, { encoding: "utf8", flag: "wx" });
      createdFiles.push(file.absolutePath);
    }
  } catch (error) {
    await rollback(createdFiles, createdDirectories, io);

    throw error;
  }

  return plan.files.map((file) => file.relativePath);
}

/**
 * Converts a kebab-case name to PascalCase.
 *
 * @param value - Kebab-case identifier.
 * @returns PascalCase identifier.
 */
function toPascalCase(value) {
  return value
    .split("-")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

/**
 * Converts a kebab-case name to spaced title case.
 *
 * @param value - Kebab-case identifier.
 * @returns Title-case label.
 */
function toTitleCase(value) {
  return value
    .split("-")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/**
 * Returns the four capability file contents in path order.
 *
 * @param kind - Capability kind.
 * @param className - PascalCase class name.
 * @param fileBase - File base name including the kind suffix.
 * @param mcpName - MCP identifier.
 * @param name - Kebab-case base name.
 * @param title - Title-case label.
 * @returns Class, schema, type, and spec file contents.
 */
function capabilityContents(kind, className, fileBase, mcpName, name, title) {
  if (kind === "tool") {
    return [
      renderTool(className, fileBase, mcpName, name),
      renderToolSchemas(className),
      renderToolTypes(className, fileBase),
      renderToolSpec(className, fileBase),
    ];
  }

  if (kind === "resource") {
    return [
      renderResource(className, fileBase, name, title),
      renderResourceSchemas(className),
      renderResourceTypes(className, fileBase),
      renderResourceSpec(className, fileBase, name),
    ];
  }

  return [
    renderPrompt(className, fileBase, mcpName, name),
    renderPromptSchemas(className),
    renderPromptTypes(className, fileBase),
    renderPromptSpec(className, fileBase, name),
  ];
}

/**
 * Rejects resolved paths that escape the working directory.
 *
 * @param cwd - Generation root.
 * @param files - Planned files.
 */
function assertSafePaths(cwd, files) {
  const root = cwd.endsWith(sep) ? cwd : `${cwd}${sep}`;

  for (const file of files) {
    if (file.absolutePath !== cwd && !file.absolutePath.startsWith(root)) {
      throw new Error(`Refusing to write outside the project directory: ${file.relativePath}`);
    }

    if (relative(cwd, file.absolutePath).startsWith("..") || relative(cwd, file.absolutePath).includes(`..${sep}`)) {
      throw new Error(`Refusing to write outside the project directory: ${file.relativePath}`);
    }
  }
}

/**
 * Ensures none of the planned files already exist.
 *
 * @param files - Planned files.
 * @param io - Filesystem functions.
 */
async function assertTargetsAreFree(files, io) {
  const collisions = [];

  for (const file of files) {
    if (await exists(file.absolutePath, io)) {
      collisions.push(file.relativePath);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Refusing to overwrite existing file${collisions.length === 1 ? "" : "s"}: ${collisions.join(", ")}`,
    );
  }
}

/**
 * Lists parent directories that do not exist yet, shallowest first.
 *
 * @param files - Planned files.
 * @param io - Filesystem functions.
 * @returns Absolute directory paths to create.
 */
async function collectMissingDirectories(files, io) {
  const missing = [];
  const seen = new Set();

  for (const file of files) {
    const ancestors = [];

    for (
      let directoryPath = dirname(file.absolutePath);
      !seen.has(directoryPath);
      directoryPath = dirname(directoryPath)
    ) {
      seen.add(directoryPath);
      ancestors.push(directoryPath);

      if (directoryPath === dirname(directoryPath) || (await exists(directoryPath, io))) {
        break;
      }
    }

    for (const directoryPath of ancestors.reverse()) {
      if (!(await exists(directoryPath, io)) && !missing.includes(directoryPath)) {
        missing.push(directoryPath);
      }
    }
  }

  return missing;
}

/**
 * Removes files and directories created during a failed generation.
 *
 * @param createdFiles - Files written before the failure.
 * @param createdDirectories - Directories created before the failure, shallowest first.
 * @param io - Filesystem functions.
 */
async function rollback(createdFiles, createdDirectories, io) {
  for (const filePath of [...createdFiles].reverse()) {
    await io.rm(filePath, { force: true });
  }

  for (const directoryPath of [...createdDirectories].reverse()) {
    await io.rm(directoryPath, { force: true, recursive: true });
  }
}

/**
 * Returns whether a path exists.
 *
 * @param path - Absolute path.
 * @param io - Filesystem functions.
 * @returns True when the path exists.
 */
async function exists(path, io) {
  try {
    await io.stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

/**
 * Renders a tool class file.
 *
 * @param className - PascalCase tool class name.
 * @param fileBase - File base name including the kind suffix.
 * @param mcpName - MCP tool name.
 * @param name - Kebab-case base name.
 * @returns File contents.
 */
function renderTool(className, fileBase, mcpName, name) {
  return `import { tool } from "../../core/decorators";
import type { IMcpToolHandler } from "../../core/types";
import { ${className}InputSchema, ${className}OutputSchema } from "./${fileBase}.schemas";
import type { ${className}InputType, ${className}OutputType } from "./${fileBase}.types";

/**
 * Handles ${name} tool requests.
 */
@tool({
  name: "${mcpName}",
  description: "Describe the ${name} tool.",
  inputSchema: ${className}InputSchema,
  outputSchema: ${className}OutputSchema,
})
export class ${className} implements IMcpToolHandler {
  /**
   * Handles a validated ${name} request.
   *
   * @param input - Validated tool input.
   * @returns The tool result.
   */
  public handler(input: ${className}InputType): ${className}OutputType {
    return {
      result: input.value,
    };
  }
}
`;
}

/**
 * Renders tool schemas.
 *
 * @param className - PascalCase tool class name.
 * @returns File contents.
 */
function renderToolSchemas(className) {
  return `import { z } from "zod";

// Tool input schema: placeholder string value. Transform-free so input equals output.
export const ${className}InputSchema = z.object({
  value: z.string(),
});

// Tool output schema: object-shaped because structured tool output is an object.
export const ${className}OutputSchema = z.object({
  result: z.string(),
});
`;
}

/**
 * Renders tool types.
 *
 * @param className - PascalCase tool class name.
 * @param fileBase - File base name including the kind suffix.
 * @returns File contents.
 */
function renderToolTypes(className, fileBase) {
  return `import type { z } from "zod";

import type { ${className}InputSchema, ${className}OutputSchema } from "./${fileBase}.schemas";

// Schema-derived tool input type.
export type ${className}InputType = z.output<typeof ${className}InputSchema>;

// Schema-derived tool output type.
export type ${className}OutputType = z.output<typeof ${className}OutputSchema>;
`;
}

/**
 * Renders a tool spec.
 *
 * @param className - PascalCase tool class name.
 * @param fileBase - File base name including the kind suffix.
 * @returns File contents.
 */
function renderToolSpec(className, fileBase) {
  return `import { describe, expect, it } from "vitest";

import { ${className} } from "./${fileBase}";
import { ${className}InputSchema, ${className}OutputSchema } from "./${fileBase}.schemas";

describe("${className} schemas", () => {
  it("accepts a string value", () => {
    expect(${className}InputSchema.safeParse({ value: "ok" }).success).toBe(true);
  });

  it("rejects a missing value", () => {
    expect(${className}InputSchema.safeParse({}).success).toBe(false);
  });

  it("produces object-shaped output", () => {
    expect(${className}OutputSchema.safeParse({ result: "ok" }).success).toBe(true);
    expect(${className}OutputSchema.safeParse("ok").success).toBe(false);
  });
});

describe("${className} handler", () => {
  it("echoes the validated value", () => {
    const tool = new ${className}();

    expect(tool.handler({ value: "ok" })).toEqual({ result: "ok" });
  });
});
`;
}

/**
 * Renders a resource class file.
 *
 * @param className - PascalCase resource class name.
 * @param fileBase - File base name including the kind suffix.
 * @param name - Kebab-case base name.
 * @param title - Title-case label.
 * @returns File contents.
 */
function renderResource(className, fileBase, name, title) {
  return `import { resource } from "../../core/decorators";
import type { IMcpResourceHandler } from "../../core/types";
import type { ${className}Type } from "./${fileBase}.types";

/**
 * Provides ${name} resource content.
 */
@resource({
  uri: "${name}://info",
  name: "${title}",
  description: "Describe the ${name} resource.",
  mimeType: "text/plain",
})
export class ${className} implements IMcpResourceHandler {
  /**
   * Returns ${name} content.
   *
   * @param _uri - URI requested by the MCP client.
   * @returns The plain-text resource body.
   */
  public handler(_uri: string): ${className}Type {
    return "Describe the ${name} resource.";
  }
}
`;
}

/**
 * Renders resource schemas.
 *
 * @param className - PascalCase resource class name.
 * @returns File contents.
 */
function renderResourceSchemas(className) {
  return `import { z } from "zod";

// Resource domain result schema: a plain-text placeholder body.
export const ${className}Schema = z.string();
`;
}

/**
 * Renders resource types.
 *
 * @param className - PascalCase resource class name.
 * @param fileBase - File base name including the kind suffix.
 * @returns File contents.
 */
function renderResourceTypes(className, fileBase) {
  return `import type { z } from "zod";

import type { ${className}Schema } from "./${fileBase}.schemas";

// Schema-derived resource domain result type.
export type ${className}Type = z.output<typeof ${className}Schema>;
`;
}

/**
 * Renders a resource spec.
 *
 * @param className - PascalCase resource class name.
 * @param fileBase - File base name including the kind suffix.
 * @param name - Kebab-case base name.
 * @returns File contents.
 */
function renderResourceSpec(className, fileBase, name) {
  return `import { describe, expect, it } from "vitest";

import { ${className} } from "./${fileBase}";
import { ${className}Schema } from "./${fileBase}.schemas";

describe("${className} schemas", () => {
  it("accepts a plain-text body", () => {
    expect(${className}Schema.safeParse("Describe the ${name} resource.").success).toBe(true);
  });

  it("rejects non-string values", () => {
    expect(${className}Schema.safeParse(1).success).toBe(false);
    expect(${className}Schema.safeParse({ text: "no" }).success).toBe(false);
  });
});

describe("${className} handler", () => {
  it("returns the placeholder body unchanged", () => {
    const resource = new ${className}();

    expect(resource.handler("${name}://info")).toBe("Describe the ${name} resource.");
  });
});
`;
}

/**
 * Renders a prompt class file.
 *
 * @param className - PascalCase prompt class name.
 * @param fileBase - File base name including the kind suffix.
 * @param mcpName - MCP prompt name.
 * @param name - Kebab-case base name.
 * @returns File contents.
 */
function renderPrompt(className, fileBase, mcpName, name) {
  return `import { prompt } from "../../core/decorators";
import type { IMcpPromptHandler } from "../../core/types";
import { ${className}ArgsSchema } from "./${fileBase}.schemas";
import type { ${className}ArgsType } from "./${fileBase}.types";

/**
 * Builds a ${name} prompt.
 */
@prompt({
  name: "${mcpName}",
  description: "Describe the ${name} prompt.",
  argsSchema: ${className}ArgsSchema,
  role: "user",
})
export class ${className} implements IMcpPromptHandler {
  /**
   * Builds the ${name} instruction.
   *
   * @param args - Validated prompt arguments.
   * @returns The prompt text.
   */
  public handler(args: ${className}ArgsType): string {
    return \`Describe the ${name} prompt for:\\n\\n\${args.topic}\`;
  }
}
`;
}

/**
 * Renders prompt schemas.
 *
 * @param className - PascalCase prompt class name.
 * @returns File contents.
 */
function renderPromptSchemas(className) {
  return `import { z } from "zod";

// Prompt argument schema: a required topic string. Transform-free so input equals output.
export const ${className}ArgsSchema = z.object({
  topic: z.string(),
});
`;
}

/**
 * Renders prompt types.
 *
 * @param className - PascalCase prompt class name.
 * @param fileBase - File base name including the kind suffix.
 * @returns File contents.
 */
function renderPromptTypes(className, fileBase) {
  return `import type { z } from "zod";

import type { ${className}ArgsSchema } from "./${fileBase}.schemas";

// Schema-derived prompt argument type.
export type ${className}ArgsType = z.output<typeof ${className}ArgsSchema>;
`;
}

/**
 * Renders a prompt spec.
 *
 * @param className - PascalCase prompt class name.
 * @param fileBase - File base name including the kind suffix.
 * @param name - Kebab-case base name.
 * @returns File contents.
 */
function renderPromptSpec(className, fileBase, name) {
  return `import { describe, expect, it } from "vitest";

import { ${className} } from "./${fileBase}";
import { ${className}ArgsSchema } from "./${fileBase}.schemas";

describe("${className}ArgsSchema", () => {
  it("accepts a topic string", () => {
    expect(${className}ArgsSchema.safeParse({ topic: "example" }).success).toBe(true);
  });

  it("rejects a missing topic", () => {
    expect(${className}ArgsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string topic", () => {
    expect(${className}ArgsSchema.safeParse({ topic: 123 }).success).toBe(false);
  });
});

describe("${className} handler", () => {
  it("builds the instruction from the supplied topic", () => {
    const generatedPrompt = new ${className}();

    expect(generatedPrompt.handler({ topic: "example" })).toBe("Describe the ${name} prompt for:\\n\\nexample");
  });
});
`;
}

/**
 * Renders an injectable service class.
 *
 * @param className - PascalCase service class name.
 * @param name - Kebab-case base name.
 * @returns File contents.
 */
function renderService(className, name) {
  return `import { injectable } from "inversify";

/**
 * Placeholder ${name} service.
 */
@injectable()
export class ${className} {
  /**
   * Returns a placeholder value.
   *
   * @returns The placeholder string.
   */
  public getValue(): string {
    return "${name}";
  }
}
`;
}

/**
 * Renders a service spec.
 *
 * @param className - PascalCase service class name.
 * @param fileBase - File base name including the kind suffix.
 * @param name - Kebab-case base name.
 * @returns File contents.
 */
function renderServiceSpec(className, fileBase, name) {
  return `import { describe, expect, it } from "vitest";

import { ${className} } from "./${fileBase}";

describe("${className}", () => {
  it("returns the placeholder value", () => {
    const service = new ${className}();

    expect(service.getValue()).toBe("${name}");
  });
});
`;
}

/**
 * Runs the generator as a CLI.
 *
 * @param argv - Arguments after the script path.
 * @param cwd - Working directory.
 */
export async function runGenerateCli(argv, cwd = process.cwd()) {
  const { kind, name } = parseGenerateArgs(argv);
  const written = await generateScaffold(kind, name, { cwd });

  process.stdout.write(`Created:\n${written.map((path) => `  ${path}`).join("\n")}\n`);
}

const cliEntry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;

if (cliEntry === import.meta.url) {
  runGenerateCli(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
