# 00 - Project bootstrap and stdio handshake

Status: [ ] Not started

Source: `PLAN.md` sections "Layout", "Dependency injection and lifetimes", "Server factory (stdio and later HTTP)", "Logger (pino)", and "Tooling".

Depends on: None.

## Outcome

A clean checkout can install, run checks, build the ESM executable, and connect an MCP client to an empty stdio server. This is the first observable flow: the process completes MCP initialization without writing diagnostics into protocol stdout.

## Implementation

- [ ] Verify the current published `@modelcontextprotocol/server` v2 entry points and types for `McpServer`, `serveStdio`, `StdioServerHandle`, and handler request context. Verify compatible stable Zod 4, Inversify, `reflect-metadata` if required, TypeScript, Vitest, Biome, tsx, Pino, and Node 20+ versions before pinning dependencies and committing a lockfile. Confirm the pinned Inversify version's `Newable`, `Container`, `ResolutionContext`, `toFactory`, binding-scope, and decorator APIs against its live declarations.
- [ ] Create `package.json` as private ESM package `mcp-framework` with the planned `bin`, engine requirement, and scripts: `build`, `dev`, `start`, `lint`, `format`, and `test`. Include Inversify and its required metadata runtime as runtime dependencies. Keep Inspector external to project dependencies.
- [ ] Add `.gitignore`, `tsconfig.json`, `tsconfig.build.json`, Biome configuration, and minimal Vitest configuration only if defaults are insufficient. Include all `src` files for editor/tests, exclude specs, `node_modules`, and `dist` from build output, and enable the verified legacy-decorator and emitted-metadata compiler settings required by Inversify.
- [ ] Add `src/utils/logger.ts` with Pino JSON output pinned to file descriptor 2, logger name `mcp-framework`, and `LOG_LEVEL` defaulting to `info`.
- [ ] Add a transport-independent `src/core/create-server.ts` that creates a named and versioned empty `McpServer`.
- [ ] Add `src/core/transports/stdio.ts` with the smallest stdio adapter needed to call the verified `serveStdio` API, return its handle, report transport errors through Pino, and log one startup event. Signal shutdown is deliberately deferred to task 06.
- [ ] Add executable `src/main.ts` with a shebang, load `reflect-metadata` before decorated modules if the pinned Inversify version requires it, define a fresh `createAppServer` factory, and call `startStdio(createAppServer)`. Do not create the application container or add sample capabilities yet.
- [ ] Add a focused smoke spec around server construction or startup seams without introducing a generalized test harness.
- [ ] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [ ] `npm install`, `npm run lint`, `npm test`, and `npm run build` succeed on the selected Node baseline.
- [ ] `node dist/main.js` starts a valid MCP stdio process and an MCP client or Inspector completes initialization and lists zero capabilities.
- [ ] The executable emits protocol traffic only on stdout and startup or error diagnostics only on stderr.
- [ ] `dist/main.js` keeps its shebang and `dist` contains no `*.spec.js`.

## Verification

- [ ] Run the configured install, lint, test, and build commands from a clean working tree.
- [ ] Launch `npx @modelcontextprotocol/inspector node dist/main.js`, connect, and confirm initialization plus empty tool, resource, and prompt listings.
- [ ] Inspect or capture stdout and stderr separately to confirm JSON logs cannot corrupt JSON-RPC output.
- [ ] Run `find dist -name '*.spec.js'` and confirm it returns no files.

## Deliberately deferred

Tool, resource, and prompt registration; decorators; application-container composition; dependency bindings; result mapping; complete public capability types; request-extra proof; signal shutdown; comprehensive tests; Cursor configuration; and README polish belong to later tasks. Do not create empty capability folders or an HTTP transport stub.
