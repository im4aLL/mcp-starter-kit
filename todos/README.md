# MCP class-based starter implementation backlog

## Goal

Deliver a copyable, class-based TypeScript MCP starter that runs over stdio, exposes one obvious tool, resource, and prompt, keeps domain handlers separate from MCP wire mapping, and is easy to verify and extend with small local developer scripts without becoming a reusable framework package.

## Authority and baseline

[PLAN.md](../PLAN.md) is authoritative for the starter baseline, contracts, behavior, and completion constraints. This backlog turns that plan into an observable-first implementation sequence and adds the approved local developer-script follow-ups in tasks 08 and 09. The inspected repository contains only `PLAN.md`, repository instructions, and logs. There is no package manifest, lockfile, source code, test configuration, or established command to preserve.

Follow `/Users/hadi/.agents/DEVELOPMENT_WORKFLOW.md`: make the smallest coherent execution path runnable first, verify it, add one capability at a time, and harden proven behavior afterward. Every task must leave the starter runnable and keep all checks introduced by earlier tasks passing.

## Assumptions and decisions

- npm is the intended package manager because the plan defines npm scripts, `npx`, package `bin`, and npm package metadata. Task 00 must verify and lock the actual dependency set.
- The empty-server handshake in task 00 is intentionally temporary but coherent: it proves the executable, SDK, stdio, logging, and build boundaries before capability contracts are added.
- Exact SDK v2 callback and result type names remain an implementation-time verification item. Use exported SDK types rather than copying or inventing equivalents.
- Inversify is the composition mechanism. Task 00 must verify its current constructor, decorator, scope, factory, and reflection requirements before versions and compiler options are pinned.
- Project-owned `@tool`, `@prompt`, and `@resource` decorators apply Inversify `injectable()` metadata internally, so capability authors use one class decorator. They never bind, discover, or register classes; `getCapabilityTypes()` remains the one explicit constructor list. Non-capability service classes still use `@injectable()` directly.
- Every application server gets a new container. `src/providers.ts` lists ordinary concrete services for default singleton self-binding and can supply explicit custom bindings when needed. Developers add application services without editing generic `src/core/container.ts`. An injected `toFactory` provider is the documented option for a fresh dependency per handler call.
- Capability classes implement concise non-generic handler interfaces. Schema-derived method annotations and typed decorator target constraints preserve the schema relationship.
- Normal application development must not require edits inside `src/core/`. Developers register capabilities in `src/capabilities/capabilities.ts`, register services and custom bindings in `src/providers.ts`, and edit core only when intentionally changing framework behavior.
- The final package is private and locally copyable. Publishing, HTTP, OAuth, standalone generator packages, and broad framework extensibility remain out of scope. Task 08 adds only a small repository-local scaffold script.

## Proposed structure

Create files only when their task needs them. The final mental map is:

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Executable entry point, per-server composition factory, and stdio startup |
| `src/providers.ts` | Application-owned concrete service list and optional custom bindings |
| `src/capabilities/capabilities.ts` | Explicit `getCapabilityTypes()` constructor lists |
| `src/core/container.ts` | Generic per-server Inversify container, default scope, configured provider binding, and capability binding |
| `src/core/types.ts` | Non-generic handler contracts, typed metadata, constructor lists, resolved capability records, JSON values, and SDK request-extra alias |
| `src/core/decorators.ts` | Typed capability decorators that apply injectable metadata plus direct MCP metadata readers |
| `src/core/resolve-capabilities.ts` | Constructor-list validation, dependency resolution, and runtime capability assembly |
| `src/core/create-server.ts` | Transport-independent `McpServer` creation and resolved capability registration |
| `src/core/register-capabilities.ts` | SDK callback registration and unchanged request-extra forwarding |
| `src/core/map-results.ts` | Domain result mapping, SDK wire-result pass-through, and resource serialization |
| `src/core/transports/stdio.ts` | Stdio serving, boundary logging, signal handling, and shutdown |
| `src/services/calculator-service.ts` | Small injectable service demonstrating constructor injection |
| `src/tools`, `src/resources`, `src/prompts` | Replaceable capability classes using one framework decorator, schemas, types, and co-located specs |
| `scripts/` | Repository-local Node scripts for capability scaffolding and metadata listing |
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
| [05 Type, decorator, dependency-injection, and request-context contracts](05-type-schema-and-context-contracts.md) | [ ] Not started | 04 | Decorator typing, constructor heterogeneity, DI lifetimes, factory providers, and SDK context forwarding are proven |
| [06 Stdio lifecycle and diagnostics](06-stdio-lifecycle-and-diagnostics.md) | [ ] Not started | 05 | Signals close the transport predictably and all diagnostics remain on stderr |
| [07 Verification, packaging, and starter documentation](07-verification-packaging-and-docs.md) | [ ] Not started | 06 | Clean install, checks, build, bin execution, Cursor, and Inspector workflows are verified and documented |
| [08 Capability scaffold generator](08-capability-generator.md) | [ ] Not started | 07 | A local Node script generates a safe starter scaffold for a tool, resource, or prompt |
| [09 List registered capabilities in the console](09-list-capabilities-script.md) | [ ] Not started | 08 | A local Node script prints registered tools, resources, and prompts in a console table |

## Sequence rationale

Task 00 establishes a real protocol process and verifies the Inversify and decorator toolchain rather than beginning with unobservable composition infrastructure. Task 01 adds the first end-to-end capability and, only then, introduces typed decorators, explicit constructor registration, per-server container resolution, and constructor injection because the working tool requires those seams. Tasks 02-03 reuse that path for the remaining capability kinds. Task 04 expands the proven paths to the full result and serialization contract. Task 05 hardens decorator typing, constructor-list validation, DI lifetimes, factory providers, and SDK ownership seams. Task 06 hardens lifecycle behavior and logging after the execution flow exists. Task 07 performs clean-consumer verification and documents only behavior demonstrated by the completed starter. Tasks 08 and 09 then add narrow developer conveniences on top of stable capability conventions: scaffold generation first, followed by metadata listing directly from registered constructors. Because those tasks change package scripts and documentation after task 07, task 09 repeats the final clean-consumer and package checks.

## Global implementation rules

- Use `@modelcontextprotocol/server` v2 and Zod 4 after verifying the live package APIs and compatible versions during task 00. Do not use `@modelcontextprotocol/sdk` v1.
- Keep TypeScript ESM strict with `NodeNext`, Node types, Node 20 or newer, Biome, Vitest, and separate editor/test and build TypeScript configurations.
- Use the SDK to apply tool input/output schemas and prompt argument schemas. Core registration and mapping code must never call `.parse()`.
- Keep sample method parameters and returns explicitly annotated with schema-derived types while capability classes implement non-generic `McpToolHandler`, `McpPromptHandler`, or `McpResourceHandler` interfaces. Typed decorators must enforce schema compatibility.
- Keep MCP metadata on constructors through project-owned decorators. Each capability decorator also applies Inversify injectable metadata, so do not repeat `@injectable()` on capability classes. Do not add instance metadata fields, automatic discovery, source scanning, or a hidden registry.
- Keep `getCapabilityTypes()` as the explicit constructor composition and resolve it through one new Inversify container per application server.
- Keep ordinary application service constructors and exceptional custom bindings in `src/providers.ts`; do not add application service imports to generic `src/core/container.ts`.
- Keep all normal capability and provider extension work outside `src/core/`. Changes under `src/core/` must represent intentional changes to framework behavior, not routine application registration.
- Keep the container at the composition root. Capability classes use constructor injection and never call `container.get()`.
- Default listed service bindings to singleton within one server, allow explicit transient overrides through provider configuration, and use an injected factory provider only for dependencies that must be new per handler invocation.
- Return domain values by default and permit already-built SDK wire results to pass through unchanged.
- Write protocol data only to stdout. Send every log through Pino to file descriptor 2.
- Give every function, class, and class method a standard TSDoc block. Types in `*.types.ts` and schemas in `*.schemas.ts` do not require TSDoc.
- Keep `main.ts` thin, create the container and resolve capabilities inside the server factory, and keep transport lifecycle in `src/core/transports/stdio.ts`.
- Keep specs co-located and exclude them from `dist`.
- Do not add HTTP, OAuth, publishing automation, standalone generator packages, pretty logging, extra samples, or speculative extension systems. Keep task 08 as a narrow repository-local Node script.

## Completion criteria

- [ ] A clean checkout installs from the committed lockfile and passes format-check or lint, type checking, tests, and build commands.
- [ ] `dist/main.js` is executable through `node`, the package bin, and the documented Cursor configuration.
- [ ] A real MCP client or Inspector lists and exercises `add`, `project://info`, and `code_review`.
- [ ] Domain and SDK wire-result paths match `PLAN.md`, including safe tool failures and strict resource serialization.
- [ ] Request extras are optional and forwarded unchanged, per-server containers isolate capability and singleton service instances, heterogeneous constructors compile together, and decorator/schema mismatches fail type checking.
- [ ] Signal handling closes the stdio handle and diagnostics never corrupt stdout.
- [ ] `dist` contains no emitted specs and `npm pack --dry-run` contains no unintended source, test, secret, or local artifact.
- [ ] The short README covers the verified starter workflow, required rename points, capability generation, and capability listing.
- [ ] The local generator safely scaffolds each decorated capability kind without overwriting files, the listing script prints metadata from all explicitly registered constructors without creating a container or starting a transport, and final clean-consumer packaging checks pass after both scripts are added.
