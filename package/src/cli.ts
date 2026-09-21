import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { parseArgs } from "./args";
import type { ICliContext, ICliDependencies } from "./cli.types";
import {
  DEFAULT_PROJECT_VERSION,
  STARTERKIT_IGNORE_FILE,
  TEMPLATE_NAME_TOKEN,
  TEMPLATE_REPOSITORY,
  TEMPLATE_TOKEN_FILES,
} from "./constants";
import { ScaffoldError } from "./errors";
import { initRepository } from "./git-init";
import { fail, info, printNextSteps, printUsage, printVersion, warn } from "./log";
import { deriveBinName, validateProjectName } from "./name";
import { pruneTemplate } from "./prune";
import { applyRename } from "./rename";
import { cloneTemplate, resolveTemplateTag } from "./template";

/**
 * Prompts interactively for a project name.
 *
 * @returns The trimmed project name entered by the user.
 */
async function promptForName(): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await readline.question("Project name: ");

    return answer.trim();
  } finally {
    readline.close();
  }
}

/**
 * Binds the production CLI dependencies to their concrete implementations.
 *
 * @returns The default dependency set.
 */
function createDefaultDependencies(): ICliDependencies {
  return {
    resolveTemplateTag,
    cloneTemplate,
    pruneTemplate,
    applyRename,
    initRepository,
    promptForName,
  };
}

/**
 * Resolves the project name from arguments or an interactive prompt.
 *
 * @param provided - Name supplied on the command line, when present.
 * @param dependencies - Injected collaborators for prompting.
 * @returns The trimmed project name.
 * @throws {ScaffoldError} When no name is provided and stdin is not interactive.
 */
async function resolveProjectName(provided: string | undefined, dependencies: ICliDependencies): Promise<string> {
  if (provided !== undefined) {
    return provided.trim();
  }

  if (process.stdin.isTTY !== true) {
    throw new ScaffoldError(
      "A project name is required when stdin is not interactive. Pass a name, for example: create-mcp-starter-kit my-server",
    );
  }

  return (await dependencies.promptForName()).trim();
}

/**
 * Ensures the target directory does not already contain files.
 *
 * @param targetDir - Absolute destination directory.
 * @throws {ScaffoldError} When the path exists as a file or a non-empty directory.
 */
async function ensureTargetAvailable(targetDir: string): Promise<void> {
  let entries: string[];

  try {
    entries = await readdir(targetDir);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    if (error instanceof Error && "code" in error && error.code === "ENOTDIR") {
      throw new ScaffoldError(`Path "${targetDir}" already exists and is not a directory.`);
    }

    throw error;
  }

  if (entries.length > 0) {
    throw new ScaffoldError(`Directory "${targetDir}" is not empty.`);
  }
}

/**
 * Runs the scaffold flow and returns a process exit code.
 *
 * @param argv - Arguments after the executable and script path.
 * @param context - Working directory and running CLI version.
 * @param dependencies - Injected collaborators, defaulting to the real implementations.
 * @returns `0` on success, `1` on an expected failure.
 */
export async function runCli(
  argv: string[],
  context: ICliContext,
  dependencies: ICliDependencies = createDefaultDependencies(),
): Promise<number> {
  let targetDir: string | undefined;
  let cloned = false;

  try {
    const args = parseArgs(argv);

    if (args.help) {
      printUsage();

      return 0;
    }

    if (args.version) {
      printVersion(context.cliVersion);

      return 0;
    }

    const name = await resolveProjectName(args.name, dependencies);
    validateProjectName(name);

    const binName = deriveBinName(name);
    targetDir = resolve(context.cwd, binName);

    await ensureTargetAvailable(targetDir);

    const tag = await dependencies.resolveTemplateTag(TEMPLATE_REPOSITORY, args.tag, context.cliVersion);
    info(`Cloning ${TEMPLATE_REPOSITORY} at ${tag}...`);

    await dependencies.cloneTemplate(TEMPLATE_REPOSITORY, tag, targetDir);
    cloned = true;

    await rm(resolve(targetDir, ".git"), { recursive: true, force: true });
    await dependencies.pruneTemplate(targetDir, STARTERKIT_IGNORE_FILE);
    await dependencies.applyRename(
      targetDir,
      { name, binName, version: DEFAULT_PROJECT_VERSION },
      { token: TEMPLATE_NAME_TOKEN, paths: TEMPLATE_TOKEN_FILES },
    );

    const initialized = await dependencies.initRepository(targetDir);

    if (!initialized) {
      warn("git init failed; the project was created without a git repository.");
    }

    printNextSteps(binName);

    return 0;
  } catch (error) {
    if (cloned && targetDir !== undefined) {
      await rm(targetDir, { recursive: true, force: true });
    }

    if (error instanceof ScaffoldError) {
      fail(error.message);

      return 1;
    }

    fail(error instanceof Error ? error.message : String(error));

    return 1;
  }
}
