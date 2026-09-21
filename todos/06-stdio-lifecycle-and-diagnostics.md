# 06 - Stdio lifecycle and diagnostics

Status: [x] Done

Source: `PLAN.md` sections "Server factory (stdio and later HTTP)", "Logger (pino)", and "Transport now vs later".

Depends on: [05 Type, decorator, dependency-injection, and request-context contracts](05-type-schema-and-context-contracts.md).

## Outcome

The stdio executable starts through a reusable server factory, reports boundary events only to stderr, and uses guarded `SIGINT` and `SIGTERM` handlers to close its SDK handle exactly once before exiting.

## Implementation

- [x] Finalize `startStdio(createServer)` against the verified SDK signature and return `StdioServerHandle` so tests and callers can close the transport directly. The supplied application factory must continue creating a new container and resolving capabilities for each server; the transport must not own or reuse a global container.
- [x] Capture the handle returned by `serveStdio` and install `process.once` handlers for `SIGINT` and `SIGTERM` inside the stdio transport, not in `main.ts` or reusable server construction.
- [x] Guard shutdown with one shared `isShuttingDown` flag so repeated instances of one signal and mixed `SIGINT`/`SIGTERM` delivery cannot start a second close operation.
- [x] Implement shutdown to log the first signal, call `handle.close()` once, set `process.exitCode = 1` if closing fails, log failure with `{ err }`, and call `process.exit()` only after the close promise settles.
- [x] Keep stdio `onerror`, one startup event, shutdown start, and shutdown failure as the transport's logging boundaries. Do not log each capability invocation.
- [x] Audit mapper and registration failures so tool exceptions and resource serialization failures use Pino's `err` key and no code uses `console.log` or `console.error`.
- [x] Keep `main.ts` limited to imports, the fresh `createAppServer` definition, and `startStdio(createAppServer)`.
- [x] Add focused lifecycle tests with injected or mocked `serveStdio`, process signal registration, exit, logger boundaries, and repeated application-factory calls. Verify close ordering, repeated-signal and mixed-signal suppression, and per-server container isolation without terminating the test process.
- [x] Add a subprocess smoke test that initializes the built server, closes stdin or sends one supported signal, and confirms bounded clean termination without protocol contamination.
- [x] Add TSDoc above every introduced or changed function, class, and class method.

## Acceptance criteria

- [x] Calling `startStdio` returns the exact SDK handle.
- [x] Either supported signal initiates one close call, mixed or repeated signals do not initiate another, shutdown waits for settlement, and then exits.
- [x] Close rejection logs a structured error, sets failure exit status, and still exits after settlement.
- [x] Startup, invocation failures, and shutdown never place log bytes on stdout.
- [x] The executable remains reusable with a future transport because server creation has no signal or stdio ownership.

## Verification

- [x] Run lifecycle unit tests covering success, close rejection, both signals, repeated delivery of the same signal, and mixed `SIGINT`/`SIGTERM` delivery.
- [x] Build and launch `dist/main.js` as a subprocess, complete an MCP handshake, send `SIGINT`, and inspect exit status plus separate stdout/stderr captures.
- [x] Repeat the focused path for `SIGTERM` where supported by the local environment.
- [x] Search source for `console.log` and `console.error` and confirm no matches.
- [x] Run full lint, tests, and build.

## Deliberately deferred

Windows `SIGBREAK`, `beforeExit`, forced shutdown deadlines, HTTP lifecycle, daemon supervision, pretty logs, per-call logs, and advanced observability infrastructure.
