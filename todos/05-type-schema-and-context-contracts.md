# 05 - Type, schema, and request-context contracts

Status: [ ] Not started

Source: `PLAN.md` sections "Request extra", "Schema ownership", "Heterogeneous capability collections", and "Server factory (stdio and later HTTP)".

Depends on: [04 Result mapping and serialization](04-result-mapping-and-serialization.md).

## Outcome

The starter proves its intended authoring contract at compile time and registration time: capability classes keep exact schema-derived handler types, heterogeneous instances share one collection, the SDK owns schema application, request context is forwarded unchanged, and every server receives fresh instances.

## Implementation

- [ ] Resolve `McpRequestExtra` from the verified SDK v2 registration callback type instead of inventing a parallel context. Keep it optional on all specific and erased handlers.
- [ ] Finalize `McpTool`, `McpResource`, and `McpPrompt` contracts with schema-object generics, `z.output`, documented result unions, readonly metadata, and method signatures compatible with one-argument sample handlers.
- [ ] Finalize `AnyMcpTool`, `AnyMcpResource`, `AnyMcpPrompt`, and `Capabilities`, erasing only collection-boundary handler inputs and retaining schemas plus metadata.
- [ ] Ensure registration callbacks pass SDK-applied arguments and the exact same `extra` object to tool, resource, and prompt handlers. Core must not call input, output, or argument schema `.parse()`.
- [ ] Add `src/core/capabilities.types.spec.ts` with a second test-only tool whose input and output schemas differ from `AddTool`; prove both classes are assignable to `Capabilities["tools"]` under strict function types.
- [ ] Add type assertions that each real class retains its specific input and result inference and that one-argument handlers remain assignable because the optional extra is represented through method syntax.
- [ ] Add registration tests using transformed test-only schemas to prove transforms execute once in the SDK and handlers receive schema output values. Do not add a transformed runtime sample.
- [ ] Add identity assertions for request-extra forwarding across tools, resources, and prompts, including access to the verified `mcpReq` fields without wrapping.
- [ ] Prove repeated `createAppServer()` calls run `getCapabilities()` again and do not reuse capability instances.
- [ ] Add TSDoc above every introduced or changed function, class, and class method.

## Acceptance criteria

- [ ] Two differently typed tool classes compile in one readonly capability list without casts in either class.
- [ ] Sample handlers can omit `extra`, while an extra-aware test capability receives the original SDK object by identity.
- [ ] Tool output, tool input, and prompt argument schemas are registered with the SDK and are never parsed in core code.
- [ ] Transformed test input reaches the handler as `z.output`, not raw `z.input` and not a double-transformed value.
- [ ] Every server factory invocation gets fresh tools, resources, and prompts.

## Verification

- [ ] Run the strict TypeScript check against all source and type-level specs.
- [ ] Run focused registration tests with schema parse spies or transform counters and request-extra identity assertions.
- [ ] Run the full lint, test, and build commands and confirm type-only fixtures are absent from `dist`.

## Deliberately deferred

A custom invocation context, authentication context, middleware, runtime cancellation/progress samples, a general DI container, HTTP transport, and additional production capabilities.
