# 01 - Add tool vertical slice

Status: [ ] Not started

Source: `PLAN.md` sections "Core contract", "Schema ownership", "Heterogeneous capability collections", "Server factory (stdio and later HTTP)", and "Samples (easy to delete when copying)".

Depends on: [00 Project bootstrap and stdio handshake](00-project-bootstrap.md).

## Outcome

A client can list `add`, call it with `{ "a": 1, "b": 2 }`, and receive text `{"result":3}` plus structured output `{ "result": 3 }`. Invalid input is rejected by the SDK before the class handler runs.

## Implementation

- [ ] Add `src/tools/add-tool/add-tool.schemas.ts` with transform-free Zod 4 object schemas for numeric `a` and `b` input and numeric `result` output.
- [ ] Add schema-derived types in `add-tool.types.ts` and a specifically typed `AddTool` class in `add-tool.ts`. Keep the handler pure and omit the optional request-extra argument in this sample.
- [ ] Introduce the tool-specific and erased tool contracts in `src/core/types.ts`, parameterized by schema objects and `z.output`. Include the optional verified SDK request-extra alias in handler signatures and use method syntax on erased handlers.
- [ ] Introduce the minimum `Capabilities` shape needed by the planned composition boundary without adding speculative registries or base classes.
- [ ] Add `src/capabilities/capabilities.ts` with `getCapabilities()` returning a fresh `AddTool` instance on every call and empty resource and prompt arrays.
- [ ] Add `src/core/map-results.ts` support for domain tool output: JSON serialize it into one text content block and include the same object as `structuredContent`. Add safe tool error mapping and boundary logging for thrown handlers.
- [ ] Add `src/core/register-capabilities.ts` to register tool metadata and schemas with the SDK and call `handler(args, extra)` without parsing either input or output in core.
- [ ] Update `createServer` to accept capabilities and update `main.ts` so `getCapabilities()` runs inside `createAppServer`.
- [ ] Add focused schema, handler, mapper, and registration tests, including proof that malformed input does not invoke the handler.
- [ ] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [ ] MCP discovery exposes one tool named `add` with the expected description and schemas.
- [ ] A valid call returns matching JSON text and structured content.
- [ ] The SDK rejects missing or nonnumeric inputs before `AddTool.handler` executes.
- [ ] A thrown tool error becomes an MCP tool error result and is logged through the Pino `err` key without writing to stdout.
- [ ] `getCapabilities()` creates a new `AddTool` for each server factory call.

## Verification

- [ ] Run lint, tests, and build.
- [ ] Use Inspector or a real SDK client to list `add`, call it with valid values, and inspect both content representations.
- [ ] Call `add` with invalid input and verify the protocol reports schema failure while a focused spy confirms no handler call.
- [ ] Start two application servers and verify their tool instances are not referentially equal.

## Deliberately deferred

Resources, prompts, nontrivial JSON resource serialization, mixed SDK wire results, the second type-only tool, full request-extra forwarding proof, shutdown signals, and final documentation.
