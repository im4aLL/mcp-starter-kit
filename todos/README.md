# MCP class-based starter implementation backlog

## Goal

Deliver a copyable, class-based TypeScript MCP starter that runs over stdio, exposes one obvious tool, resource, and prompt, keeps domain handlers separate from MCP wire mapping, and is easy to verify and replace without becoming a reusable framework package.

## Authority and baseline

[PLAN.md](../PLAN.md) is authoritative for the target layout, contracts, behavior, scope, and completion constraints. This backlog turns that plan into an observable-first implementation sequence. The inspected repository contains only `PLAN.md`, repository instructions, and logs. There is no package manifest, lockfile, source code, test configuration, or established command to preserve.

Follow `/Users/hadi/.agents/DEVELOPMENT_WORKFLOW.md`: make the smallest coherent execution path runnable first, verify it, add one capability at a time, and harden proven behavior afterward. Every task must leave the starter runnable and keep all checks introduced by earlier tasks passing.

## Assumptions and decisions

- npm is the intended package manager because the plan defines npm scripts, `npx`, package `bin`, and npm package metadata. Task 00 must verify and lock the actual dependency set.
- The empty-server handshake in task 00 is intentionally temporary but coherent: it proves the executable, SDK, stdio, logging, and build boundaries before capability contracts are added.
- Exact SDK v2 callback and result type names remain an implementation-time verification item. Use exported SDK types rather than copying or inventing equivalents.
- The final package is private and locally copyable. Publishing, HTTP, OAuth, generators, and broad framework extensibility remain out of scope.

## Proposed structure

Create files only when their task needs them. The final mental map is:

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Executable entry point, fresh application server factory, and stdio startup |
| `src/capabilities/capabilities.ts` | Fresh sample capability composition |
| `src/core/types.ts` | Specific capability contracts, erased collection contracts, JSON values, and SDK request-extra alias |
| `src/core/create-server.ts` | Transport-independent `McpServer` creation and capability registration |
| `src/core/register-capabilities.ts` | SDK callback registration and unchanged request-extra forwarding |
| `src/core/map-results.ts` | Domain result mapping, SDK wire-result pass-through, and resource serialization |
| `src/core/transports/stdio.ts` | Stdio serving, boundary logging, signal handling, and shutdown |
| `src/tools`, `src/resources`, `src/prompts` | Replaceable sample capability classes, schemas, types, and co-located specs |
| `src/utils/logger.ts` | Pino logger pinned to stderr |
| `tsconfig*.json`, `biome.json`, package files | Development, build, formatting, lint, test, and executable package configuration |
| `README.md` | Short copy, rename, capability, build, Cursor, and Inspector workflow |

## Execution order

Numeric order is the recommended implementation sequence and each task lists its explicit prerequisite.

| Task | Status | Depends on | Observable outcome |
| --- | --- | --- | --- |
| [00 Project bootstrap and stdio handshake](00-project-bootstrap.md) | [ ] Not started | None | The built package starts and an MCP client completes a handshake against an empty server |
| [01 Add tool vertical slice](01-add-tool.md) | [ ] Not started | 00 | A client lists and calls `add` with SDK-validated input and output |
| [02 Project info resource](02-project-info-resource.md) | [ ] Not started | 01 | A client lists and reads `project://info` |
| [03 Code review prompt](03-code-review-prompt.md) | [ ] Not started | 02 | A client lists and retrieves `code_review` |
| [04 Result mapping and serialization](04-result-mapping-and-serialization.md) | [ ] Not started | 03 | Domain shortcuts and SDK wire results behave predictably across all capability kinds |
| [05 Type, schema, and request-context contracts](05-type-schema-and-context-contracts.md) | [ ] Not started | 04 | Heterogeneous capabilities remain strongly typed and SDK context is forwarded unchanged |
| [06 Stdio lifecycle and diagnostics](06-stdio-lifecycle-and-diagnostics.md) | [ ] Not started | 05 | Signals close the transport predictably and all diagnostics remain on stderr |
| [07 Verification, packaging, and starter documentation](07-verification-packaging-and-docs.md) | [ ] Not started | 06 | Clean install, checks, build, bin execution, Cursor, and Inspector workflows are verified and documented |

## Sequence rationale

Task 00 establishes a real protocol process rather than configuration-only scaffolding. Tasks 01-03 complete one developer-visible MCP capability at a time. Task 04 expands the proven paths to the full result and serialization contract. Task 05 proves the TypeScript and SDK ownership seams. Task 06 hardens lifecycle behavior and logging after the execution flow exists. Task 07 performs clean-consumer verification and documents only behavior demonstrated by the completed starter.

## Global implementation rules

- Use `@modelcontextprotocol/server` v2 and Zod 4 after verifying the live package APIs and compatible versions during task 00. Do not use `@modelcontextprotocol/sdk` v1.
- Keep TypeScript ESM strict with `NodeNext`, Node types, Node 20 or newer, Biome, Vitest, and separate editor/test and build TypeScript configurations.
- Use the SDK to apply tool input/output schemas and prompt argument schemas. Core registration and mapping code must never call `.parse()`.
- Keep sample capability classes specifically typed. Erase handler input types only at the `Capabilities` collection boundary using method syntax.
- Return domain values by default and permit already-built SDK wire results to pass through unchanged.
- Write protocol data only to stdout. Send every log through Pino to file descriptor 2.
- Give every function, class, and class method a standard TSDoc block. Types in `*.types.ts` and schemas in `*.schemas.ts` do not require TSDoc.
- Keep `main.ts` thin, create capability instances inside the server factory, and keep transport lifecycle in `src/core/transports/stdio.ts`.
- Keep specs co-located and exclude them from `dist`.
- Do not add HTTP, OAuth, publishing automation, generators, pretty logging, extra samples, or speculative extension systems.

## Completion criteria

- [ ] A clean checkout installs from the committed lockfile and passes format-check or lint, type checking, tests, and build commands.
- [ ] `dist/main.js` is executable through `node`, the package bin, and the documented Cursor configuration.
- [ ] A real MCP client or Inspector lists and exercises `add`, `project://info`, and `code_review`.
- [ ] Domain and SDK wire-result paths match `PLAN.md`, including safe tool failures and strict resource serialization.
- [ ] Request extras are optional and forwarded unchanged, fresh factories produce fresh capability instances, and heterogeneous tool types compile together.
- [ ] Signal handling closes the stdio handle and diagnostics never corrupt stdout.
- [ ] `dist` contains no emitted specs and `npm pack --dry-run` contains no unintended source, test, secret, or local artifact.
- [ ] The short README covers only the verified starter workflow and the required rename points.
