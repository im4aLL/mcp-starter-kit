# 01 - Add tool vertical slice

Status: [x] Done

Source: `PLAN.md` sections "Core contract", "Dependency injection and lifetimes", "Schema ownership", "Decorated capability constructors and resolved collections", "Server factory (stdio and later HTTP)", and "Samples (easy to delete when copying)".

Depends on: [00 Project bootstrap and stdio handshake](00-project-bootstrap.md).

## Outcome

A client can list `add`, call it with `{ "a": 1, "b": 2 }`, and receive text `{"result":3}` plus structured output `{ "result": 3 }`. Invalid input is rejected by the SDK before the class handler runs. The first vertical slice also proves the intended authoring flow: typed capability metadata, explicit constructor registration, constructor injection, one container per server, and resolved runtime registration.

## Target shape

`AddTool` keeps the simple non-generic implements clause. `AddToolInputType` and `AddToolOutputType` are derived from the schemas, the method annotations enforce the local contract, and the typed `@tool` decorator verifies that the method is compatible with the schemas in its metadata.

```ts
/**
 * Adds two numbers through the calculator service.
 */
@tool({
  name: "add",
  description: "Adds two numbers together.",
  inputSchema: AddToolInputSchema,
  outputSchema: AddToolOutputSchema,
})
export class AddTool implements IMcpToolHandler {
  /**
   * Creates an add tool.
   *
   * @param calculator - Calculator used by the tool.
   */
  public constructor(
    @inject(CalculatorService)
    private readonly calculator: CalculatorService,
  ) {}

  /**
   * Adds the supplied numbers.
   *
   * @param input - Validated tool input.
   * @returns The structured addition result.
   */
  public handler(input: AddToolInputType): AddToolOutputType {
    return {
      result: this.calculator.add(input.a, input.b),
    };
  }
}
```

The explicit composition list contains constructors, not instances:

```ts
/**
 * Returns the capability constructors registered by the application.
 *
 * @returns Explicit tool, prompt, and resource constructor lists.
 */
export function getCapabilityTypes(): ICapabilities {
  return {
    tools: [AddTool],
    prompts: [],
    resources: [],
  };
}
```

The application-owned provider configuration lists ordinary service constructors. The generic application container self-binds them with singleton scope by default, so adding a normal service does not require editing `src/core/container.ts`. Scope still belongs to composition, so `AddTool` does not change if a developer later replaces the ordinary provider entry with a custom transient binding.

```ts
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;

const container = createAppContainer(capabilityTypes, providers);
```

## Implementation

- [x] Add `src/tools/add-tool/add-tool.schemas.ts` with transform-free Zod 4 object schemas for numeric `a` and `b` input and object output `{ result: number }`.
- [x] Add schema-derived `AddToolInputType` and `AddToolOutputType` types in `add-tool.types.ts`.
- [x] Add an injectable `CalculatorService` in `src/services/calculator-service.ts` with a deterministic `add(a, b)` method. Use the concrete class as its service identifier because the starter has one implementation and no abstraction boundary to justify an interface token.
- [x] Introduce non-generic `IMcpToolHandler`, tool metadata, Inversify `Newable`-based constructor-list, resolved-tool, `ICapabilities`, and runtime `IResolvedCapabilities` contracts in `src/core/types.ts`. Use method syntax with an erased `unknown` input on the runtime handler interface so resolved registration can invoke it, while the typed decorator retains schema-specific checking. Keep metadata on constructors and resolved records, not as fields added to capability instances.
- [x] Add a typed `@tool` decorator and direct metadata reader in `src/core/decorators.ts`. Before applying Inversify's bare `injectable()` metadata, check the shared capability metadata store and reject a constructor already marked by another capability decorator. Do not select a scope. Store immutable tool metadata without replacing the constructor, mutating the prototype, binding or registering globally, scanning modules, or inheriting metadata implicitly. Constrain the decorator target so its handler accepts `z.output<TInputSchema>` and returns the allowed result for `z.output<TOutputSchema>`.
- [x] Add `AddTool` in the target shape above with only `@tool(...)`, `implements IMcpToolHandler`, explicit schema-derived method annotations, and constructor injection via `@inject(CalculatorService)`. Do not repeat `@injectable()` on a capability class. Omit the optional request-extra argument in this sample.
- [x] Add `src/capabilities/capabilities.ts` with `getCapabilityTypes()` returning `[AddTool]` and empty prompt and resource constructor arrays. This is the only capability registration list; do not add decorator-driven discovery.
- [x] Add `IProviderConfiguration` and `createAppContainer(capabilityTypes, providers)` in `src/core/container.ts`. Create `new Container({ defaultScope: "Singleton" })`, explicitly self-bind every constructor in `providers.services`, invoke the optional custom binding callback, and explicitly bind every listed capability constructor to itself. Keep this file generic and free of application service imports. Do not rely on autobinding.
- [x] Add `src/providers.ts` with a `providers` configuration whose `services` list contains `CalculatorService`. This is the application-owned service composition point developers update for ordinary concrete services; do not add an `others` category without distinct binding behavior.
- [x] Add `src/core/resolve-capabilities.ts` to read metadata, resolve each listed constructor from the supplied container, and produce runtime `IResolvedCapabilities` records for registration. Fail before registration when a listed constructor lacks `@tool` or has the wrong capability decorator.
- [x] Add `src/core/map-results.ts` support for domain tool output: JSON serialize it into one text content block and include the same object as `structuredContent`. Add safe tool error mapping and boundary logging for thrown handlers.
- [x] Add `src/core/register-capabilities.ts` to register resolved tool metadata and schemas with the SDK and call the resolved instance's `handler(args, extra)` without parsing input or output in core.
- [x] Update `createServer` to accept resolved runtime capabilities. Update `main.ts` so each `createAppServer()` call gets the constructor list, passes the imported provider configuration to a new application container, resolves the capabilities, and passes them to `createServer`.
- [x] Add focused schema, handler, decorator metadata, provider configuration, container, resolver, mapper, and registration tests. Include proof that `@tool` alone makes a constructor-injected capability resolvable, listed providers are self-bound without application imports in core, malformed input does not invoke the handler, the default binding returns the same `CalculatorService` within one container, and separate server factories do not share the service or tool instance.
- [x] Add compile-time tests proving a mismatched tool output type is rejected by the typed decorator while `class AddTool implements IMcpToolHandler` remains non-generic. Cover the complete constructor-list, resolution, erased-handler invocation, and registration path without a cast for `AddTool`.
- [x] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [x] MCP discovery exposes one tool named `add` with the expected decorator-owned description and schemas.
- [x] A valid call returns matching JSON text and structured content.
- [x] The SDK rejects missing or nonnumeric inputs before `AddTool.handler` executes.
- [x] A thrown tool error becomes an MCP tool error result and is logged through the Pino `err` key without writing to stdout.
- [x] `getCapabilityTypes()` contains `AddTool`, not `new AddTool()`, and there is no hidden capability registry or source scan.
- [x] `AddTool` receives `CalculatorService` through constructor injection, uses no explicit `@injectable()` decorator, and never accesses the container.
- [x] `CalculatorService` is declared in `src/providers.ts`, generic container code binds it without importing it, normal bindings are singleton within one application container, and separate `createAppServer()` calls produce isolated containers, services, and capability instances.
- [x] After the generic core path exists, adding or replacing an application capability or ordinary service requires no edits under `src/core/`; core changes are reserved for intentional framework behavior changes.
- [x] The typed decorator rejects a handler result that does not match `AddToolOutputSchema`; for the object schema, returning a bare number does not compile.

## Verification

- [x] Run lint, tests, and build. (`npm run typecheck` was added and is now part of `npm test`, so `tsc -p tsconfig.json` - the only config that includes `*.spec.ts` - runs in the standard verification flow.)
- [x] Use Inspector or a real SDK client to list `add`, call it with valid values, and inspect both content representations. (No Inspector or client package is installed, so a raw JSON-RPC stdio client script was run against `dist/main.js`; it listed `add` and verified text `{"result":3}` plus structured `{ "result": 3 }`.)
- [x] Call `add` with invalid input and verify the protocol reports schema failure while a focused spy confirms no handler call. (Both the missing-operand `{ a: 1 }` and nonnumeric `{ a: "x", b: 2 }` shapes are driven through the live SDK path in `register-capabilities.spec.ts` and both return `isError`, with the handler spy still at one valid call.)
- [x] Resolve listed `CalculatorService` and `AddTool` bindings repeatedly from one container and verify singleton behavior, then create two application servers and verify their containers, services, and tools are not referentially equal. (Two `createAppContainer` + `resolveCapabilities` factory invocations were used because `createAppServer` is not exported from `main.ts`.)
- [x] Run the negative type fixture and confirm an incompatible schema-derived handler result fails compilation for the expected reason. (`npm run typecheck` now enforces this: removing the `@ts-expect-error` yields `src/core/capabilities.types.spec.ts(67,2): error TS1238`, the typed-decorator rejection; restoring it passes.)

## Deliberately deferred

Resources, prompts, nontrivial JSON resource serialization, mixed SDK wire results, complete duplicate-identifier validation, full request-extra forwarding proof, explicit transient overrides, per-invocation factory providers, shutdown signals, and final documentation.
