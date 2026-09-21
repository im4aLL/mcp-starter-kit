# 05 - Type, decorator, dependency-injection, and request-context contracts

Status: [x] Done

Source: `PLAN.md` sections "Request extra", "Dependency injection and lifetimes", "Schema ownership", "Decorated capability constructors and resolved collections", and "Server factory (stdio and later HTTP)".

Depends on: [04 Result mapping and serialization](04-result-mapping-and-serialization.md).

## Outcome

The starter proves its intended authoring and composition contracts at compile time and runtime: capability classes use concise non-generic handler interfaces, typed decorators preserve exact schema relationships, heterogeneous constructors share one explicit list, the SDK owns schema application, request context is forwarded unchanged, container scopes are selectable without changing consumers, factory providers can create a dependency per handler invocation, and every server owns isolated capability and service instances.

## Target shapes

A normal consumer does not select dependency lifetime:

```ts
/**
 * Adds two numbers through an injected calculator.
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

The composition root chooses singleton or transient scope without changing `AddTool`. The starter lists its ordinary concrete service in application-owned `src/providers.ts`; generic container code self-binds it under the singleton-default container:

```ts
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;
```

An application that wants one instance per capability resolution omits that service from the ordinary list and supplies a custom binding from `src/providers.ts`:

```ts
export const providers = {
  services: [],

  /**
   * Registers application-specific provider bindings.
   *
   * @param container - Application container to configure.
   */
  configure(container: Container): void {
    container
      .bind(CalculatorService)
      .toSelf()
      .inTransientScope();
  },
} satisfies IProviderConfiguration;
```

A transient constructor dependency is retained by its resolved capability. When a new service is required for every `handler()` call, inject a factory function instead. Both the transient service binding and factory binding belong in application-owned `src/providers.ts`; developers must not add them to `src/core/container.ts`:

```ts
export type CalculatorFactory = () => CalculatorService;

export const SERVICE_TOKENS = {
  CalculatorFactory: Symbol.for("CalculatorFactory"),
} as const;

export const providers = {
  services: [],

  /**
   * Registers the transient calculator and its per-invocation factory.
   *
   * @param container - Application container to configure.
   */
  configure(container: Container): void {
    container
      .bind(CalculatorService)
      .toSelf()
      .inTransientScope();

    container
      .bind<CalculatorFactory>(SERVICE_TOKENS.CalculatorFactory)
      .toFactory((context: ResolutionContext) => {
        return () => context.get(CalculatorService);
      });
  },
} satisfies IProviderConfiguration;
```

The corresponding alternate tool class is:

```ts
/**
 * Adds two numbers with a calculator created for each invocation.
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
   * @param createCalculator - Factory for calculator instances.
   */
  public constructor(
    @inject(SERVICE_TOKENS.CalculatorFactory)
    private readonly createCalculator: CalculatorFactory,
  ) {}

  /**
   * Adds the supplied numbers.
   *
   * @param input - Validated tool input.
   * @returns The structured addition result.
   */
  public handler(input: AddToolInputType): AddToolOutputType {
    const calculator = this.createCalculator();

    return {
      result: calculator.add(input.a, input.b),
    };
  }
}
```

This factory-based class is documentation and a test fixture, not a second runtime `add` capability.

## Implementation

- [x] Resolve `McpRequestExtraType` from the verified SDK v2 registration callback type instead of inventing a parallel context. Keep it optional on all non-generic handler interfaces and decorator target contracts.
- [x] Finalize `IMcpToolHandler`, `IMcpResourceHandler`, and `IMcpPromptHandler` as concise non-generic authoring contracts and the erased runtime invocation boundary. Use method syntax and `unknown` for schema-owned arguments so resolved registration can invoke handlers, while schema-specific input and output types remain on each class method and in each typed decorator target constraint.
- [x] Finalize typed `IToolMetadata`, `ResourceMetadata`, and `PromptMetadata`, Inversify `Newable`-based `ICapabilities`, internal resolved capability records, and runtime `IResolvedCapabilities`. Metadata is readonly and remains separate from handler instances. Constrain tool output schemas and domain outputs to JSON objects because MCP `structuredContent` is object-shaped.
- [x] Finalize `IProviderConfiguration` with a readonly concrete `services` constructor list and an optional custom binding callback. Keep `src/providers.ts` as the application-owned composition point and `src/core/container.ts` generic. Bind ordinary services first, custom bindings second, and capabilities last. Document that developers select non-default lifetimes, including transient services and per-invocation factories, in `src/providers.ts` without editing `src/core/container.ts`, and that custom-bound services must be omitted from `services` to avoid duplicate bindings.
- [x] Finalize `@tool`, `@resource`, and `@prompt` around one shared discriminated constructor-metadata store. Before applying Inversify's bare `injectable()` decorator, each decorator must reject a constructor already marked by another capability decorator with a contextual class-evaluation error. Apply `injectable()` without selecting a scope, store immutable metadata keyed by the exact constructor, and never replace constructors, mutate prototypes beyond Inversify metadata, bind classes, register globally, discover modules, or inherit capability metadata implicitly. Document that combining an explicit `@injectable()` with a capability decorator is unsupported and fails during class evaluation.
- [x] Validate the explicit constructor lists before MCP registration. Reject missing metadata, a constructor listed under the wrong capability kind, duplicate tool names, duplicate prompt names, and duplicate resource URIs with contextual startup errors.
- [x] Ensure registration callbacks pass SDK-applied arguments and the exact same `extra` object to resolved tool, resource, and prompt handlers. Core must not call input, output, or argument schema `.parse()`.
- [x] Add `src/core/capabilities.types.spec.ts` with a second decorated test-only tool whose schemas and constructor dependencies differ from `AddTool`. Prove both constructors are assignable to `ICapabilities["tools"]` without casts and that the complete constructor-list, resolution, erased invocation, and registration path type-checks without per-capability assertions.
- [x] Add negative type fixtures proving the typed decorators reject incompatible handler input and output annotations. Prove the real classes retain schema-derived method types despite using `implements IMcpToolHandler`, `implements IMcpPromptHandler`, and `implements IMcpResourceHandler` without generic arguments, and prove capability classes do not need a second `@injectable()` decorator.
- [x] Add registration tests using transformed test-only schemas to prove transforms execute once in the SDK and handlers receive schema output values. Do not add a transformed runtime sample.
- [x] Add identity assertions for request-extra forwarding across tools, resources, and prompts, including access to the verified `mcpReq` fields without wrapping.
- [x] Test provider and container scope policy: every ordinary constructor listed in `providers.services` is self-bound and singleton within one application container, an explicit custom `.inTransientScope()` binding returns separate instances across capability resolutions, a custom-bound service is not also listed as an ordinary service, and two application containers never share singleton instances.
- [x] Add a test-only `CalculatorFactory` provider using the verified Inversify `toFactory` and `ResolutionContext` APIs. Prove two factory calls return distinct transient `CalculatorService` instances and that one resolved singleton tool can obtain a new service for each handler invocation.
- [x] Keep the runtime `AddTool` on direct `CalculatorService` injection. Document the factory shape above as the opt-in pattern for per-invocation creation rather than adding a second runtime capability.
- [x] Prove repeated `createAppServer()` calls create new containers, resolve fresh capability instances, and isolate default-singleton services.
- [x] Add TSDoc above every introduced or changed function, class, and class method.

## Acceptance criteria

- [x] Two differently typed and dependency-bearing tool constructors compile in one readonly capability list without casts.
- [x] A class can use only `@tool(...)` plus `implements IMcpToolHandler` without `@injectable()` or schema generic arguments, while its explicitly annotated handler remains checked against the metadata schemas and its constructor dependencies resolve through Inversify.
- [x] A bare numeric return does not compile when `AddToolOutputSchema` describes `{ result: number }`, and top-level scalar tool output schemas are rejected because MCP structured tool output must be an object.
- [x] Sample handlers can omit `extra`, while an extra-aware test capability receives the original SDK object by identity.
- [x] Tool output, tool input, and prompt argument schemas come from decorator metadata, are registered with the SDK, and are never parsed in core code.
- [x] Transformed test input reaches the handler as `z.output`, not raw `z.input` and not a double-transformed value.
- [x] Adding an ordinary concrete service or selecting a non-default service lifetime requires changing only `src/providers.ts`, not `src/core/container.ts`; default-singleton and explicit custom transient bindings require no changes to consuming capability classes.
- [x] Documentation clearly distinguishes direct transient injection, which is new per consumer resolution, from an injected factory, which can create a new transient service on every handler invocation.
- [x] Calling an injected factory twice creates two service instances; transient constructor injection alone is not described as per-handler-call scope.
- [x] Every server factory invocation gets a fresh container, fresh capability instances, and isolated singleton services.
- [x] Capability listing and metadata inspection do not instantiate classes or resolve their dependencies.

## Verification

- [x] Run the strict TypeScript check against all source, type-level specs, and expected-error fixtures.
- [x] Run focused decorator tests for contextual multiple-capability-decorator failure and explicit `@injectable()` duplication, plus resolver tests for missing metadata, wrong capability kinds, direct-only metadata, and duplicate identifiers.
- [x] Run focused registration tests with schema transform counters and request-extra identity assertions.
- [x] Run provider and container tests for ordinary list binding, generic-core separation, per-server singleton isolation, explicit custom transient overrides, and the per-invocation factory provider.
- [x] Run the full lint, test, and build commands and confirm type-only fixtures are absent from `dist`.

## Deliberately deferred

A custom invocation context, authentication context, middleware, decorator-driven discovery, container access from handlers, per-MCP-request child containers, runtime cancellation/progress samples, HTTP transport, and additional production capabilities.
