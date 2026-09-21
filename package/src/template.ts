import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { GIT_CLONE_TIMEOUT_MS, GIT_LS_REMOTE_TIMEOUT_MS } from "./constants";
import { ScaffoldError } from "./errors";
import type { IRunGitOptions } from "./template.types";

const execFileAsync = promisify(execFile);

/**
 * Runs a git command and returns its standard output.
 *
 * @param args - Arguments passed to git.
 * @param options - Working directory and timeout for the command.
 * @returns The captured standard output.
 * @throws {ScaffoldError} When git is missing, times out, or the command fails.
 */
async function runGit(args: string[], options: IRunGitOptions = {}): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: options.cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: options.timeout,
    });

    return stdout;
  } catch (error) {
    throw new ScaffoldError(toGitErrorMessage(error));
  }
}

/**
 * Checks whether a git failure was caused by a timeout.
 *
 * `execFile` sets `killed` when a command is terminated by its own timeout, and
 * reports `ETIMEDOUT` for the same condition. External signals such as `SIGINT`
 * or `SIGKILL` are not timeouts and are reported as ordinary command failures.
 *
 * @param error - Error thrown by the git invocation.
 * @returns `true` when the command timed out.
 */
function isTimeoutError(error: Error): boolean {
  if ("killed" in error && error.killed === true) {
    return true;
  }

  return "code" in error && error.code === "ETIMEDOUT";
}

/**
 * Converts a git execution failure into a user-facing message.
 *
 * @param error - Error thrown by the git invocation.
 * @returns A concise explanation of the failure.
 */
function toGitErrorMessage(error: unknown): string {
  if (error instanceof Error && isTimeoutError(error)) {
    return "Template repository operation timed out. Check your network connection and try again.";
  }

  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    return "git executable was not found. Install git and try again.";
  }

  if (error instanceof Error) {
    const stderr = "stderr" in error ? String(error.stderr).trim() : "";

    if (stderr.length > 0) {
      return `git command failed: ${stderr}`;
    }

    return `git command failed: ${error.message}`;
  }

  return "git command failed.";
}

/**
 * Checks whether a tag exists in the template repository.
 *
 * @param repository - Git remote URL of the template repository.
 * @param tag - Tag name to look up.
 * @returns `true` when the tag is present, otherwise `false`.
 */
async function tagExists(repository: string, tag: string): Promise<boolean> {
  const stdout = await runGit(["ls-remote", "--tags", "--refs", repository, `refs/tags/${tag}`], {
    timeout: GIT_LS_REMOTE_TIMEOUT_MS,
  });

  return stdout.trim().length > 0;
}

/**
 * Resolves the template tag to clone.
 *
 * Defaults to `v<cliVersion>` so a pinned CLI version scaffolds the matching
 * template release. An explicit tag overrides the default.
 *
 * @param repository - Git remote URL of the template repository.
 * @param explicitTag - Tag supplied by the user, when present.
 * @param cliVersion - Running CLI package version.
 * @returns The tag to clone.
 * @throws {ScaffoldError} When the resolved tag does not exist.
 */
export async function resolveTemplateTag(
  repository: string,
  explicitTag: string | undefined,
  cliVersion: string,
): Promise<string> {
  const tag = explicitTag ?? `v${cliVersion}`;

  if (await tagExists(repository, tag)) {
    return tag;
  }

  if (explicitTag === undefined) {
    throw new ScaffoldError(
      `Template tag "${tag}" was not found in ${repository}. Pass --tag <ref> to choose another release.`,
    );
  }

  throw new ScaffoldError(`Template tag "${tag}" was not found in ${repository}.`);
}

/**
 * Shallow-clones a single template tag into the target directory.
 *
 * @param repository - Git remote URL of the template repository.
 * @param tag - Tag to clone.
 * @param targetDir - Absolute destination directory.
 * @throws {ScaffoldError} When the clone fails.
 */
export async function cloneTemplate(repository: string, tag: string, targetDir: string): Promise<void> {
  await runGit(["clone", "--depth=1", "--single-branch", "--branch", tag, repository, targetDir], {
    timeout: GIT_CLONE_TIMEOUT_MS,
  });
}
