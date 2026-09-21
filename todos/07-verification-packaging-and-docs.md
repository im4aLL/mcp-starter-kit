# 07 - Verification, packaging, and starter documentation

Status: [x] Done

Source: `PLAN.md` sections "Tooling", "Samples (easy to delete when copying)", "Logger (pino)", "Transport now vs later", and "Out of scope".

Depends on: [06 Stdio lifecycle and diagnostics](06-stdio-lifecycle-and-diagnostics.md).

## Outcome

A developer can clone or copy the starter, install it cleanly, run all checks, build and launch the package from compiled output, configure Cursor, inspect all three sample capabilities, and understand exactly what to rename or replace.

## Implementation

- [x] Review co-located specs and close behavior gaps for sample handlers and schemas, decorator metadata and type safety, constructor-list composition, dependency injection and scope behavior, domain and wire result mapping, resource serialization, registration, schema ownership, extra forwarding, per-server isolation, transport errors, and shutdown. Extend existing tests rather than duplicating fixtures.
- [x] Verify `tsconfig.json` covers application plus specs, Vitest, and type checking, while `tsup` bundles only runnable source into a single `dist/main.js` with correct imports and no spec files.
- [x] Verify the package `bin` points to `dist/main.js`, the emitted entry retains a shebang, and `npm run start` plus local package-bin execution work from outside the repository working directory.
- [x] Run a clean install from the committed lockfile and execute lint, test, build, and start checks on Node 20 or the newer supported baseline selected in task 00.
- [x] Run `npm pack --dry-run` and inspect the file list. Exclude tests, local logs, secrets, editor state, and unintended artifacts while retaining required runtime files.
- [x] Perform the documented Inspector smoke test against `node dist/main.js`: call `add`, read `project://info`, and retrieve `code_review`.
- [x] Perform a local Cursor stdio smoke check with the absolute built path when Cursor is available. Record any unverified manual step honestly rather than claiming it passed.
- [x] Write a short root `README.md` covering prerequisites, copy and rename points, install/build/start commands, the single-decorator capability pattern, explicit constructor registration through `getCapabilityTypes()`, ordinary singleton service registration through `src/providers.ts`, custom provider bindings for non-default lifetimes, the rule that routine application extension does not modify `src/core/`, Cursor configuration, and the Inspector command.
- [x] Explicitly tell copiers to rename package `name`, `bin`, Pino logger name where desired, and the `McpServer` name. Briefly document that capability decorators already apply injectable metadata, while non-capability services use `@injectable()` directly. Also document concrete-class constructor injection, default singleton scope, explicit transient override in `src/providers.ts`, and the injected `toFactory` pattern in `src/providers.ts` for per-handler fresh dependencies. Explain that direct transient injection is new per consumer resolution, not automatically per handler call, and that none of these application bindings require editing `src/core/container.ts`. Keep the README focused and do not turn it into broad framework documentation.
- [x] Recheck every TSDoc requirement and repository style rule, including comments, blank lines in function bodies, and absence of non-Biome formatters or linters.

## Acceptance criteria

- [x] A clean install followed by lint, test, and build passes without ignored or flaky failures.
- [x] `dist` has no spec files and `node dist/main.js` works independently of tsx or source imports.
- [x] The package bin runs after build and the dry-run tarball contains only intentional starter files.
- [x] Inspector verifies all three samples with the exact decorator-owned names, URI, roles, MIME types, and result shapes from `PLAN.md`.
- [x] Stdout remains protocol-only through startup, successful calls, rejected input, handler failure, and shutdown.
- [x] The README is short, accurate, explains explicit decorated constructor composition, identifies `src/providers.ts` as the application service composition point for singleton, transient, and factory bindings, makes clear that `src/core/` changes are only for framework behavior, distinguishes transient consumer resolution from per-handler factory creation, and distinguishes current stdio support from deferred HTTP and authentication work.

## Verification

- [x] From a clean checkout or temporary copy, run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
- [x] Run `find dist -name '*.spec.js'` and confirm no matches.
- [x] Run `npm pack --dry-run`, inspect its output, then install or execute the packed artifact in a temporary directory if the package manager permits a local bin smoke test.
- [x] Run `npx @modelcontextprotocol/inspector --cli node dist/main.js ...` and exercise `add`, `project://info`, and `code_review`. The interactive web/TUI Inspector was not run; the Inspector CLI is the headless equivalent and prints the exact protocol results.
- [ ] Start through the documented Cursor configuration and verify discovery and one invocation of each capability kind. Cursor.app is installed, but its GUI MCP integration exposes no headless list or invoke command, so discovery and in-IDE invocation remain manual. The documented launch command (`node /absolute/path/dist/main.js`) was verified over stdio instead.
- [x] Capture exact versions and commands in implementation notes or the final change summary so later maintainers can reproduce the verification.

## Implementation notes

- Verified with Node `v25.8.1` and npm `11.11.0` against `package-lock.json`; `package.json` `engines.node` is `>=20`.
- `npm ci`, `npm run lint` (Biome, 57 files), `npm test` (16 files, 182 tests), and `npm run build` all pass. `npm` reports one pre-existing low-severity advisory in `tsup`'s bundled `esbuild` (Windows dev-server file read); it is a dev dependency and was left unchanged to avoid lockfile churn beyond this task.
- `find dist -name '*.spec.js'` returns no matches; `dist/main.js` retains its `#!/usr/bin/env node` shebang and executes from outside the repository working directory.
- `npm pack --dry-run` now lists only `README.md`, `dist/main.js`, `dist/main.js.map`, `docs/providers-usage.md`, and `package.json`; the `files` field restricts the tarball to `dist` and `docs` (`private: true` remains intentional).
- The packed tarball was installed into a temporary project; `node_modules/.bin/mcp-framework` starts the server with protocol-only stdout. `npm run start` also starts cleanly (npm's own script banner is the only non-JSON stdout and comes from npm, not the server).
- The Inspector CLI verified `add` (`{"result":3}` plus matching structured content), `project://info` (`text/plain` contents and listing MIME), and `code_review` (one `user` text message).
- `main.smoke.spec.ts` covers a full subprocess session (initialize, `tools/list`, a successful `tools/call`, and rejected input) plus both signal paths, asserting stdout stays protocol-only throughout. Handler-failure stdout purity is covered at unit level because no starter capability throws.

## Deliberately deferred

Capability scaffolding and console listing remain deferred to tasks 08 and 09. HTTP and OAuth, npm publication, a standalone generator package or template CLI, extra runtime capabilities, automated IDE UI tests, pretty logs, mixed-content samples, progress/cancellation examples, binary resource domain mapping, and every other item listed under `PLAN.md` "Out of scope".
