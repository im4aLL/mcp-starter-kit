import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "..");
const distEntry = resolve(repoRoot, "dist/main.js");
const tsupCli = resolve(repoRoot, "node_modules/tsup/dist/cli-default.js");

// How the smoke test asks the server to stop.
type TerminationType = "stdin" | "SIGINT" | "SIGTERM";

// Observable result of one bounded server subprocess run.
interface ISmokeResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

const initializeRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "stdio-smoke", version: "1.0.0" },
  },
} as const;

const initializedNotification = { jsonrpc: "2.0", method: "notifications/initialized" } as const;

beforeAll(() => {
  execFileSync(process.execPath, [tsupCli], { cwd: repoRoot, stdio: "pipe" });
}, 120_000);

/**
 * Starts the built stdio server as a bounded child process.
 *
 * @returns The child process with piped stdin, stdout, and stderr.
 */
function startServer(): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [distEntry], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
}

/**
 * Resolves when the child exits, or rejects after a bounded wait.
 *
 * @param child - Child process to observe.
 * @returns The exit code and terminating signal.
 */
function waitForExit(
  child: ChildProcessWithoutNullStreams,
): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Server did not terminate within the bounded timeout."));
    }, 10_000);

    child.once("exit", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal });
    });
  });
}

/**
 * Completes the MCP initialize handshake over the child's stdio pipes.
 *
 * @param child - Running server child process.
 */
async function completeHandshake(child: ChildProcessWithoutNullStreams): Promise<void> {
  const reader = createInterface({ input: child.stdout });
  const lines = reader[Symbol.asyncIterator]();

  child.stdin.write(`${JSON.stringify(initializeRequest)}\n`);

  for (;;) {
    const next = await lines.next();

    if (next.done === true) {
      throw new Error("Server closed stdout before answering initialize.");
    }

    const message = JSON.parse(next.value) as { readonly id?: unknown };

    if (message.id === 1) {
      break;
    }
  }

  child.stdin.write(`${JSON.stringify(initializedNotification)}\n`);
  reader.close();
}

/**
 * Asks the child to stop through stdin closure or one supported signal.
 *
 * @param child - Running server child process.
 * @param termination - Stop mechanism to exercise.
 */
function terminate(child: ChildProcessWithoutNullStreams, termination: TerminationType): void {
  if (termination === "stdin") {
    child.stdin.end();

    return;
  }

  child.kill(termination);
}

/**
 * Runs the built server through a handshake and one termination path.
 *
 * @param termination - Stop mechanism to exercise.
 * @returns The bounded run's exit details plus captured streams.
 */
async function runSmoke(termination: TerminationType): Promise<ISmokeResult> {
  const child = startServer();
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => stdoutChunks.push(chunk));
  child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));

  const exit = waitForExit(child);

  try {
    await completeHandshake(child);
    terminate(child, termination);

    const settled = await exit;

    return {
      ...settled,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } catch (error) {
    child.kill("SIGKILL");
    await exit.catch(() => undefined);

    throw error;
  }
}

/**
 * Parses every non-empty stdout line as a JSON-RPC message.
 *
 * @param stdout - Captured stdout text.
 * @returns The parsed protocol messages.
 */
function parseProtocolMessages(stdout: string): Record<string, unknown>[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/**
 * Asserts that captured stdout contains JSON-RPC only and no log bytes.
 *
 * @param stdout - Captured stdout text.
 */
function assertCleanStdout(stdout: string): void {
  const messages = parseProtocolMessages(stdout);

  expect(messages.length).toBeGreaterThan(0);

  for (const message of messages) {
    expect(message.jsonrpc).toBe("2.0");
  }

  expect(stdout).not.toContain("stdio transport started");
  expect(stdout).not.toContain("stdio shutting down");
}

describe("dist/main.js stdio lifecycle", () => {
  it("handshakes, closes stdin, and terminates cleanly without protocol contamination", async () => {
    const result = await runSmoke("stdin");

    assertCleanStdout(result.stdout);
    expect(result.stderr).toContain("stdio transport started");
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it("handshakes, handles SIGINT, and exits cleanly without protocol contamination", async () => {
    const result = await runSmoke("SIGINT");

    assertCleanStdout(result.stdout);
    expect(result.stderr).toContain("stdio shutting down");
    expect(result.stderr).toContain("SIGINT");
    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
  }, 20_000);

  it("handshakes, handles SIGTERM, and exits cleanly without protocol contamination", async () => {
    const result = await runSmoke("SIGTERM");

    assertCleanStdout(result.stdout);
    expect(result.stderr).toContain("stdio shutting down");
    expect(result.stderr).toContain("SIGTERM");
    expect(result.exitCode).toBe(0);
    expect(result.signal).toBeNull();
  }, 20_000);
});
