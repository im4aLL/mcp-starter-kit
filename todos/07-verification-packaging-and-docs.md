# 07 - Verification, packaging, and starter documentation

Status: [ ] Not started

Source: `PLAN.md` sections "Tooling", "Samples (easy to delete when copying)", "Logger (pino)", "Transport now vs later", and "Out of scope".

Depends on: [06 Stdio lifecycle and diagnostics](06-stdio-lifecycle-and-diagnostics.md).

## Outcome

A developer can clone or copy the starter, install it cleanly, run all checks, build and launch the package from compiled output, configure Cursor, inspect all three sample capabilities, and understand exactly what to rename or replace.

## Implementation

- [ ] Review co-located specs and close behavior gaps for sample handlers and schemas, decorator metadata and type safety, constructor-list composition, dependency injection and scope behavior, domain and wire result mapping, resource serialization, registration, schema ownership, extra forwarding, per-server isolation, transport errors, and shutdown. Extend existing tests rather than duplicating fixtures.
- [ ] Verify `tsconfig.json` covers application plus specs and Vitest, while `tsconfig.build.json` emits only runnable source beneath `dist` with correct NodeNext imports and source layout.
- [ ] Verify the package `bin` points to `dist/main.js`, the emitted entry retains a shebang, and `npm run start` plus local package-bin execution work from outside the repository working directory.
- [ ] Run a clean install from the committed lockfile and execute lint, test, build, and start checks on Node 20 or the newer supported baseline selected in task 00.
- [ ] Run `npm pack --dry-run` and inspect the file list. Exclude tests, local logs, secrets, editor state, and unintended artifacts while retaining required runtime files.
- [ ] Perform the documented Inspector smoke test against `node dist/main.js`: call `add`, read `project://info`, and retrieve `code_review`.
- [ ] Perform a local Cursor stdio smoke check with the absolute built path when Cursor is available. Record any unverified manual step honestly rather than claiming it passed.
- [ ] Write a short root `README.md` covering prerequisites, copy and rename points, install/build/start commands, the single-decorator capability pattern, explicit constructor registration through `getCapabilityTypes()`, ordinary singleton service registration through `src/providers.ts`, custom provider bindings for non-default lifetimes, the rule that routine application extension does not modify `src/core/`, Cursor configuration, and the Inspector command.
- [ ] Explicitly tell copiers to rename package `name`, `bin`, Pino logger name where desired, and the `McpServer` name. Briefly document that capability decorators already apply injectable metadata, while non-capability services use `@injectable()` directly. Also document concrete-class constructor injection, default singleton scope, explicit transient override in `src/providers.ts`, and the injected `toFactory` pattern in `src/providers.ts` for per-handler fresh dependencies. Explain that direct transient injection is new per consumer resolution, not automatically per handler call, and that none of these application bindings require editing `src/core/container.ts`. Keep the README focused and do not turn it into broad framework documentation.
- [ ] Recheck every TSDoc requirement and repository style rule, including comments, blank lines in function bodies, and absence of non-Biome formatters or linters.

## Acceptance criteria

- [ ] A clean install followed by lint, test, and build passes without ignored or flaky failures.
- [ ] `dist` has no spec files and `node dist/main.js` works independently of tsx or source imports.
- [ ] The package bin runs after build and the dry-run tarball contains only intentional starter files.
- [ ] Inspector verifies all three samples with the exact decorator-owned names, URI, roles, MIME types, and result shapes from `PLAN.md`.
- [ ] Stdout remains protocol-only through startup, successful calls, rejected input, handler failure, and shutdown.
- [ ] The README is short, accurate, explains explicit decorated constructor composition, identifies `src/providers.ts` as the application service composition point for singleton, transient, and factory bindings, makes clear that `src/core/` changes are only for framework behavior, distinguishes transient consumer resolution from per-handler factory creation, and distinguishes current stdio support from deferred HTTP and authentication work.

## Verification

- [ ] From a clean checkout or temporary copy, run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
- [ ] Run `find dist -name '*.spec.js'` and confirm no matches.
- [ ] Run `npm pack --dry-run`, inspect its output, then install or execute the packed artifact in a temporary directory if the package manager permits a local bin smoke test.
- [ ] Run `npx @modelcontextprotocol/inspector node dist/main.js` and manually exercise `add`, `project://info`, and `code_review`.
- [ ] Start through the documented Cursor configuration when available and verify discovery and one invocation of each capability kind.
- [ ] Capture exact versions and commands in implementation notes or the final change summary so later maintainers can reproduce the verification.

## Deliberately deferred

Capability scaffolding and console listing remain deferred to tasks 08 and 09. HTTP and OAuth, npm publication, a standalone generator package or template CLI, extra runtime capabilities, automated IDE UI tests, pretty logs, mixed-content samples, progress/cancellation examples, binary resource domain mapping, and every other item listed under `PLAN.md` "Out of scope".
