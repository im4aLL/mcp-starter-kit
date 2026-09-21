import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SUPPORTED_KINDS = ["tool", "resource", "prompt", "service"];
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIRECTORY = join(SCRIPT_DIRECTORY, "templates");
const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

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
 * Validates a scaffold kind and kebab-case path.
 *
 * The path is one or more kebab-case segments separated by forward slashes.
 * Intermediate segments become nested directories, so every segment must be
 * a safe, well-formed kebab-case identifier.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case path, optionally nested (for example nested/test).
 */
function validateKindAndName(kind, name) {
  assertSupportedKind(kind);

  if (name.includes("\0") || name.includes("\\")) {
    throw new Error(
      `Unsafe name "${name}". Use a kebab-case path such as multiply or nested/test, without backslashes or parent segments.`,
    );
  }

  const segments = name.split("/");
  const baseName = segments.at(-1) ?? "";

  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error(
      `Unsafe name "${name}". Use a kebab-case path such as multiply or nested/test, without empty, current, or parent segments.`,
    );
  }

  for (const segment of segments) {
    if (!NAME_PATTERN.test(segment)) {
      throw new Error(
        `Invalid name "${name}". Use a kebab-case path such as multiply or project-info/nested (lowercase letters, digits, and single hyphens per segment).`,
      );
    }
  }

  if (baseName.endsWith(`-${kind}`)) {
    const trimmedBase = baseName.slice(0, -(kind.length + 1));

    throw new Error(
      `Name "${name}" already ends with -${kind}. Use the kebab-case base name, for example ${trimmedBase || "multiply"}.`,
    );
  }
}

/**
 * Splits CLI arguments into flags and positional values.
 *
 * @param argv - Arguments after the script path.
 * @returns Positional values and parsed flags.
 */
function parseGenerateFlags(argv) {
  let dryRun = false;
  const positionals = [];

  for (const argument of argv) {
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new Error(`Unknown option "${argument}". Use --dry-run to preview without writing files.`);
    }

    positionals.push(argument);
  }

  return { positionals, dryRun };
}

/**
 * Parses CLI arguments for the scaffold generator.
 *
 * @param argv - Arguments after the script path.
 * @returns The requested kind, kebab-case base name, and dry-run flag.
 */
export function parseGenerateArgs(argv) {
  const { positionals, dryRun } = parseGenerateFlags(argv);

  if (positionals.length === 0) {
    throw new Error(
      "Missing kind and name. Use npm run generate <tool|resource|prompt|service> <name>, for example npm run generate tool multiply.",
    );
  }

  if (positionals.length === 1) {
    assertSupportedKind(positionals[0]);

    throw new Error(
      `Missing name. Use npm run generate ${positionals[0]} <name>, for example npm run generate ${positionals[0]} multiply.`,
    );
  }

  if (positionals.length > 2) {
    throw new Error(
      `Unexpected extra arguments: ${positionals.slice(2).join(" ")}. Use npm run generate <tool|resource|prompt|service> <name>.`,
    );
  }

  const [kind, name] = positionals;

  validateKindAndName(kind, name);

  return { kind, name, dryRun };
}

/**
 * Plans output paths and file contents for one scaffold.
 *
 * File contents come from the template files under `scripts/templates`, so
 * template changes do not require editing generation logic.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case path, optionally nested (for example nested/test).
 * @param cwd - Directory that contains `src/`.
 * @returns Relative paths, absolute paths, and file contents.
 */
export async function planScaffold(kind, name, cwd) {
  validateKindAndName(kind, name);

  const segments = name.split("/");
  const baseName = segments.at(-1);
  const nestedDirectory = segments.slice(0, -1).join("/");
  const context = {
    className: `${toPascalCase(baseName)}${toPascalCase(kind)}`,
    fileBase: `${baseName}-${kind}`,
    name: baseName,
    mcpName: baseName.replaceAll("-", "_"),
    title: toTitleCase(baseName),
    coreImport: "",
  };

  if (kind === "service") {
    const relativeDirectory = nestedDirectory ? `src/services/${nestedDirectory}` : "src/services";

    context.coreImport = toRelativeFromSrc(relativeDirectory);
    const relativePaths = [
      `${relativeDirectory}/${context.fileBase}.ts`,
      `${relativeDirectory}/${context.fileBase}.spec.ts`,
    ];

    return buildPlan(kind, name, cwd, relativePaths, context, ["service.ts.template", "service.spec.ts.template"]);
  }

  const relativeDirectory = nestedDirectory ? `src/${kind}s/${nestedDirectory}` : `src/${kind}s`;
  const directory = `${relativeDirectory}/${context.fileBase}`;

  context.coreImport = toRelativeFromSrc(directory);
  const relativePaths = [
    `${directory}/${context.fileBase}.ts`,
    `${directory}/${context.fileBase}.schemas.ts`,
    `${directory}/${context.fileBase}.types.ts`,
    `${directory}/${context.fileBase}.spec.ts`,
  ];
  const templateNames = [
    `${kind}.ts.template`,
    `${kind}.schemas.ts.template`,
    `${kind}.types.ts.template`,
    `${kind}.spec.ts.template`,
  ];

  return buildPlan(kind, name, cwd, relativePaths, context, templateNames);
}

/**
 * Builds the relative import path from a generated directory to `src/core`.
 *
 * @param relativeDirectory - POSIX directory relative to the project root, under `src/`.
 * @returns Relative path such as `../../core` or `../../../core`.
 */
function toRelativeFromSrc(relativeDirectory) {
  const depthBelowSrc = relativeDirectory.split("/").length - 1;

  return `${"../".repeat(depthBelowSrc)}core`;
}

/**
 * Assembles a scaffold plan by rendering each template to its output path.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case path.
 * @param cwd - Directory that contains `src/`.
 * @param relativePaths - POSIX-relative output paths, aligned with templates.
 * @param context - Placeholder values shared by every file.
 * @param templateNames - Template file names under `scripts/templates`, aligned with paths.
 * @returns Kind, name, class name, and planned files.
 */
async function buildPlan(kind, name, cwd, relativePaths, context, templateNames) {
  const templates = await Promise.all(templateNames.map((templateName) => readTemplate(templateName)));
  const files = relativePaths.map((relativePath, index) => ({
    relativePath,
    absolutePath: resolve(cwd, relativePath),
    contents: render(templates[index], context),
  }));

  return {
    kind,
    name,
    className: context.className,
    files,
  };
}

/**
 * Substitutes `{{token}}` placeholders in a template.
 *
 * @param template - Template text.
 * @param context - Placeholder values.
 * @returns Rendered text.
 */
function render(template, context) {
  return template.replace(TOKEN_PATTERN, (match, token) =>
    Object.hasOwn(context, token) ? String(context[token]) : match,
  );
}

/**
 * Reads one template file as UTF-8 and fails when it is absent.
 *
 * @param fileName - Template file name under `scripts/templates`.
 * @returns Template text.
 */
async function readTemplate(fileName) {
  try {
    return await readFile(join(TEMPLATE_DIRECTORY, fileName), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing template file scripts/templates/${fileName}.`);
    }

    throw error;
  }
}

/**
 * Generates one capability or service scaffold without overwriting files.
 *
 * @param kind - Scaffold kind.
 * @param name - Kebab-case path, optionally nested (for example nested/test).
 * @param options - Working directory, dry-run switch, and optional filesystem overrides.
 * @returns Relative paths that were written, or would be written on a dry run.
 */
export async function generateScaffold(kind, name, options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  const dryRun = options.dryRun ?? false;
  const io = {
    mkdir: options.io?.mkdir ?? mkdir,
    rm: options.io?.rm ?? rm,
    stat: options.io?.stat ?? stat,
    writeFile: options.io?.writeFile ?? writeFile,
  };
  const plan = await planScaffold(kind, name, cwd);

  assertSafePaths(cwd, plan.files);
  await assertTargetsAreFree(plan.files, io);

  if (dryRun) {
    return plan.files.map((file) => file.relativePath);
  }

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
 * Returns whether the npm parent process requested a dry run.
 *
 * npm consumes a bare `--dry-run` as its own config flag instead of forwarding
 * it to the script, exposing it as `npm_config_dry_run` instead. Reading that
 * here makes `npm run generate <kind> <name> --dry-run` behave as expected.
 *
 * @returns True when npm reports dry-run mode.
 */
function isNpmDryRun() {
  return process.env.npm_config_dry_run === "true";
}

/**
 * Runs the generator as a CLI.
 *
 * @param argv - Arguments after the script path.
 * @param cwd - Working directory.
 */
export async function runGenerateCli(argv, cwd = process.cwd()) {
  const { kind, name, dryRun } = parseGenerateArgs(argv);
  const effectiveDryRun = dryRun || isNpmDryRun();
  const files = await generateScaffold(kind, name, { cwd, dryRun: effectiveDryRun });
  const heading = effectiveDryRun ? "Would create:" : "Created:";

  process.stdout.write(`${heading}\n${files.map((path) => `  ${path}`).join("\n")}\n`);
}

const cliEntry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;

if (cliEntry === import.meta.url) {
  runGenerateCli(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
