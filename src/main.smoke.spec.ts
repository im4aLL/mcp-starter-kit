import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import type { CallToolResult } from "@modelcontextprotocol/server";
import { beforeAll, describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDirectory, "..");
const distEntry = resolve(repoRoot, "dist/main.js");

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

// One JSON-RPC request sent after initialization during a protocol session.
interface ISmokeRequest {
  readonly id: number;
  readonly method: string;
  readonly params?: unknown;
}

beforeAll(() => {
  // shell: true lets the platform shell resolve the npm launcher (npm or npm.cmd).
  // One hardcoded command string avoids the deprecated args-plus-shell signature (DEP0190).
  execFileSync("npm run build", { cwd: repoRoot, stdio: "pipe", shell: true });
}, 120_000);

/**
 * Starts the built stdio server as a bounded child process.
 *
 * @param cwd - Working directory for the child process. Defaults to the repository root.
 * @returns The child process with piped stdin, stdout, and stderr.
 */
function startServer(cwd: string = repoRoot): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [distEntry], {
    cwd,
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
 * @param cwd - Working directory for the child process. Defaults to the repository root.
 * @returns The bounded run's exit details plus captured streams.
 */
async function runSmoke(termination: TerminationType, cwd: string = repoRoot): Promise<ISmokeResult> {
  const child = startServer(cwd);
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

/**
 * Sends one JSON-RPC request and resolves the response with the matching id.
 *
 * @param child - Running server child process.
 * @param lines - Async iterator over the server's stdout lines.
 * @param request - Request to send.
 * @returns The parsed JSON-RPC response.
 */
async function sendRequest(
  child: ChildProcessWithoutNullStreams,
  lines: AsyncIterableIterator<string>,
  request: ISmokeRequest,
): Promise<Record<string, unknown>> {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...request })}\n`);

  for (;;) {
    const next = await lines.next();

    if (next.done === true) {
      throw new Error(`Server closed stdout before answering request ${request.id}.`);
    }

    const message = JSON.parse(next.value) as { readonly id?: unknown };

    if (message.id === request.id) {
      return message as Record<string, unknown>;
    }
  }
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

describe("dist/main.js outside the repository working directory", () => {
  it("handshakes and terminates cleanly from an external cwd with stdout protocol-only", async () => {
    const outsideCwd = mkdtempSync(join(tmpdir(), "mcp-starter-kit-smoke-"));

    try {
      const result = await runSmoke("stdin", outsideCwd);

      assertCleanStdout(result.stdout);
      expect(result.stderr).toContain("stdio transport started");
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(outsideCwd, { recursive: true, force: true });
    }
  }, 20_000);
});

describe("dist/main.js protocol session", () => {
  it("keeps stdout protocol-only through startup, a successful call, rejected input, and shutdown", async () => {
    const child = startServer();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: string) => stderrChunks.push(chunk));

    const exit = waitForExit(child);
    const reader = createInterface({ input: child.stdout });
    const lines = reader[Symbol.asyncIterator]();

    try {
      const initialize = await sendRequest(child, lines, initializeRequest);
      const serverInfo = (initialize.result as { readonly serverInfo: { readonly name: string } }).serverInfo;

      expect(serverInfo.name).toBe("mcp-starter-kit");

      child.stdin.write(`${JSON.stringify(initializedNotification)}\n`);

      const list = await sendRequest(child, lines, { id: 2, method: "tools/list", params: {} });
      const listedTools = (list.result as { readonly tools: readonly { readonly name: string }[] }).tools;

      expect(listedTools.map((tool) => tool.name)).toContain("add");

      const call = await sendRequest(child, lines, {
        id: 3,
        method: "tools/call",
        params: { name: "add", arguments: { a: 1, b: 2 } },
      });
      const callResult = call.result as CallToolResult;

      expect(callResult.content).toEqual([{ type: "text", text: JSON.stringify({ result: 3 }) }]);
      expect(callResult.structuredContent).toEqual({ result: 3 });

      const rejected = await sendRequest(child, lines, {
        id: 4,
        method: "tools/call",
        params: { name: "add", arguments: { a: "not-a-number", b: 2 } },
      });
      const rejectedResult = rejected.result as CallToolResult;

      expect(rejected.error).toBeUndefined();
      expect(rejectedResult.isError).toBe(true);

      child.stdin.end();

      const settled = await exit;
      const stdout = stdoutChunks.join("");
      const stderr = stderrChunks.join("");

      assertCleanStdout(stdout);
      expect(stderr).toContain("stdio transport started");
      expect(settled.exitCode).toBe(0);
    } finally {
      reader.close();
    }
  }, 20_000);
});
