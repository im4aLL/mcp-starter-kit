import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Initializes a fresh git repository in the scaffolded project.
 *
 * @param root - Absolute path of the scaffolded project.
 * @returns `true` when initialization succeeded, otherwise `false`.
 */
export async function initRepository(root: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["init"], { cwd: root });

    return true;
  } catch {
    return false;
  }
}
