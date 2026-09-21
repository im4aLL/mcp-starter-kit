import type { McpServerFactory } from "@modelcontextprotocol/server";
import type { StdioServerHandle } from "@modelcontextprotocol/server/stdio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startStdio } from "./stdio";

const { serveStdioSpy } = vi.hoisted(() => ({ serveStdioSpy: vi.fn() }));

vi.mock("@modelcontextprotocol/server/stdio", () => ({ serveStdio: serveStdioSpy }));

// Signature of the `SIGINT` / `SIGTERM` listeners registered by the transport.
type SignalListenerType = (signal: NodeJS.Signals) => void;

// Spy for one `(bindings, message)` logging call.
type LoggerSpyType = ReturnType<typeof vi.fn<(bindings: Record<string, unknown>, message: string) => void>>;

// Logger with observable spies for the transport's logging boundaries.
interface IObservedLogger {
  readonly info: LoggerSpyType;
  readonly error: LoggerSpyType;
}

// One captured handle plus its close spy.
interface IObservedHandle {
  readonly handle: StdioServerHandle;
  readonly closeSpy: ReturnType<typeof vi.fn>;
}

const registeredSignals = new Map<NodeJS.Signals, SignalListenerType>();

let originalExitCode: number | string | null | undefined;

/**
 * Creates a logger whose boundary calls the spec can assert.
 *
 * @returns A logger with `info` and `error` spies.
 */
function createObservedLogger(): IObservedLogger {
  return {
    info: vi.fn<(bindings: Record<string, unknown>, message: string) => void>(),
    error: vi.fn<(bindings: Record<string, unknown>, message: string) => void>(),
  };
}

/**
 * Creates a handle whose `close` behavior the spec controls.
 *
 * @returns The handle and its close spy.
 */
function createObservedHandle(): IObservedHandle {
  const closeSpy = vi.fn().mockResolvedValue(undefined);

  return { handle: { close: closeSpy }, closeSpy };
}

/**
 * Creates a factory stand-in assignable to the SDK server factory contract.
 *
 * @returns A mock factory the transport can forward to `serveStdio`.
 */
function createServerFactory(): McpServerFactory {
  return vi.fn() as unknown as McpServerFactory;
}

/**
 * Delivers a signal to the listener captured by the mocked `process.once`.
 *
 * @param signal - Signal whose captured listener should run.
 */
function deliverSignal(signal: NodeJS.Signals): void {
  registeredSignals.get(signal)?.(signal);
}

/**
 * Reads the `onerror` callback the transport handed to `serveStdio`.
 *
 * @returns The captured error callback.
 */
function capturedOnerror(): (error: Error) => void {
  const options = serveStdioSpy.mock.calls[0]?.[1] as { onerror?: (error: Error) => void } | undefined;

  if (options?.onerror === undefined) {
    throw new Error("serveStdio was not called with an onerror callback.");
  }

  return options.onerror;
}

beforeEach(() => {
  registeredSignals.clear();
  originalExitCode = process.exitCode;
  serveStdioSpy.mockReset();

  vi.spyOn(process, "once").mockImplementation((event, listener) => {
    if (event === "SIGINT" || event === "SIGTERM") {
      registeredSignals.set(event, listener as SignalListenerType);
    }

    return process;
  });

  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
});

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("startStdio", () => {
  it("returns the exact SDK handle and forwards the factory unchanged", () => {
    const { handle } = createObservedHandle();
    const createServer = createServerFactory();
    serveStdioSpy.mockReturnValue(handle);

    const returned = startStdio(createServer, createObservedLogger());

    expect(returned).toBe(handle);
    expect(serveStdioSpy).toHaveBeenCalledTimes(1);
    expect(serveStdioSpy.mock.calls[0]?.[0]).toBe(createServer);
  });

  it("keeps calling the supplied factory per invocation without owning a container", () => {
    const { handle } = createObservedHandle();
    const created: object[] = [];
    const createServer = vi.fn(() => {
      const server = { id: created.length };

      created.push(server);

      return server;
    }) as unknown as McpServerFactory;

    serveStdioSpy.mockReturnValue(handle);
    startStdio(createServer, createObservedLogger());

    const forwarded = serveStdioSpy.mock.calls[0]?.[0] as McpServerFactory;
    const first = forwarded({} as Parameters<McpServerFactory>[0]);
    const second = forwarded({} as Parameters<McpServerFactory>[0]);

    expect(createServer).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
    expect(created).toHaveLength(2);
  });

  it("registers both supported signals and emits exactly one startup event", () => {
    const { handle } = createObservedHandle();
    const logger = createObservedLogger();
    serveStdioSpy.mockReturnValue(handle);

    startStdio(createServerFactory(), logger);

    expect([...registeredSignals.keys()].sort()).toEqual(["SIGINT", "SIGTERM"]);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({}, "stdio transport started");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs transport errors through the injected logger with the err key", () => {
    const { handle } = createObservedHandle();
    const logger = createObservedLogger();
    const error = new Error("transport failure");
    serveStdioSpy.mockReturnValue(handle);

    startStdio(createServerFactory(), logger);
    capturedOnerror()(error);

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({ err: error }, "stdio transport error");
  });
});

describe("startStdio shutdown", () => {
  it("closes once after SIGINT, logs the signal, and exits only after settlement", async () => {
    const logger = createObservedLogger();
    const exitSpy = vi.spyOn(process, "exit");
    let resolveClose: (() => void) | undefined;
    const closeSpy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClose = resolve;
        }),
    );
    serveStdioSpy.mockReturnValue({ close: closeSpy } as unknown as StdioServerHandle);

    startStdio(createServerFactory(), logger);
    deliverSignal("SIGINT");
    await Promise.resolve();

    expect(logger.info).toHaveBeenCalledWith({ signal: "SIGINT" }, "stdio shutting down");
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).not.toHaveBeenCalled();

    resolveClose?.();
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledTimes(1));
  });

  it("treats SIGTERM the same as SIGINT", async () => {
    const logger = createObservedLogger();
    const exitSpy = vi.spyOn(process, "exit");
    const { handle, closeSpy } = createObservedHandle();
    serveStdioSpy.mockReturnValue(handle);

    startStdio(createServerFactory(), logger);
    deliverSignal("SIGTERM");

    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledTimes(1));
    expect(logger.info).toHaveBeenCalledWith({ signal: "SIGTERM" }, "stdio shutting down");
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores a repeated delivery of the same signal", async () => {
    const logger = createObservedLogger();
    const exitSpy = vi.spyOn(process, "exit");
    const { handle, closeSpy } = createObservedHandle();
    serveStdioSpy.mockReturnValue(handle);

    startStdio(createServerFactory(), logger);
    deliverSignal("SIGINT");
    deliverSignal("SIGINT");

    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledTimes(1));
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls.filter(([, message]) => message === "stdio shutting down")).toHaveLength(1);
  });

  it("ignores a mixed SIGINT then SIGTERM delivery", async () => {
    const logger = createObservedLogger();
    const exitSpy = vi.spyOn(process, "exit");
    const { handle, closeSpy } = createObservedHandle();
    serveStdioSpy.mockReturnValue(handle);

    startStdio(createServerFactory(), logger);
    deliverSignal("SIGINT");
    deliverSignal("SIGTERM");

    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledTimes(1));
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls.filter(([, message]) => message === "stdio shutting down")).toHaveLength(1);
  });

  it("logs a structured failure, sets exitCode 1, and still exits after rejection", async () => {
    const logger = createObservedLogger();
    const exitSpy = vi.spyOn(process, "exit");
    const shutdownError = new Error("close failed");
    const { handle, closeSpy } = createObservedHandle();
    closeSpy.mockRejectedValue(shutdownError);
    serveStdioSpy.mockReturnValue(handle);

    startStdio(createServerFactory(), logger);
    deliverSignal("SIGINT");

    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledTimes(1));
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({ err: shutdownError }, "stdio shutdown failed");
    expect(process.exitCode).toBe(1);
  });

  it("keeps the process alive until a rejected close settles", async () => {
    const logger = createObservedLogger();
    const exitSpy = vi.spyOn(process, "exit");
    let rejectClose: ((error: Error) => void) | undefined;
    const closeSpy = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectClose = reject;
        }),
    );
    serveStdioSpy.mockReturnValue({ close: closeSpy } as unknown as StdioServerHandle);

    startStdio(createServerFactory(), logger);
    deliverSignal("SIGTERM");
    await Promise.resolve();

    expect(exitSpy).not.toHaveBeenCalled();

    rejectClose?.(new Error("late failure"));
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledTimes(1));
    expect(process.exitCode).toBe(1);
  });
});
