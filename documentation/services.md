---
outline: deep
---

# Services and Injection

Services hold your shared business logic. Capabilities stay thin and delegate to services, so the same logic can be tested once and reused across tools, resources, and prompts. Services are never exposed to MCP clients directly; only capabilities are visible.

## How services work

A service is a plain TypeScript class with an `@injectable()` decorator. A capability receives it through constructor injection with `@inject(ServiceClass)`. The provider configuration object `providers` lists every ordinary service so the container can create it automatically.

Ordinary services are singletons within one server instance: one shared object serves every capability. Each new server gets a fresh container, so singletons never leak across server instances.

## Create and wire a service

Generate the scaffold first. This example uses an `inventory` service.

```sh
npm run generate service inventory
```

Implement your logic in the generated class.

```ts
import { injectable } from "inversify";

@injectable()
export class InventoryService {
  public getValue(): string {
    return "inventory";
  }
}
```

Add the class to the services list in the provider configuration so capabilities can inject it.

```ts
export const providers = {
  services: [CalculatorService, InventoryService],
};
```

Inject it by its concrete class in any capability constructor.

```ts
import { inject } from "inversify";

public constructor(
  @inject(InventoryService)
  private readonly inventory: InventoryService,
) {}
```

Run typecheck and tests to confirm the wiring.

```sh
npm run typecheck
npm test
```

## Learn from the sample

Your scaffolded project ships with a calculator service that adds two numbers and an `add` tool that injects it. The service has no MCP decorator and no schema; it is pure domain logic. The tool constructor declares the dependency and the handler delegates to it. Copy that shape for your own services.

## Choose a lifetime

Most services should stay in the default services list as singletons. Change the lifetime only when behavior requires it.

A direct transient dependency gives a new instance per capability resolution, not per handler call. Use it when construction holds state that must not be shared between capabilities.

A per-invocation factory gives a fresh instance on every handler call. Use it when each request needs isolated state, such as a request-scoped calculator or a short-lived client.

To use a factory, omit the service from the services list and bind it manually in the optional `configure` step of the provider configuration. Bind the service as transient, then bind a factory token that resolves a new instance from the container.

```ts
import type { Container, ResolutionContext } from "inversify";

export type CalculatorFactoryType = () => CalculatorService;

export const SERVICE_TOKENS = {
  CalculatorFactory: Symbol.for("CalculatorFactory"),
} as const;

export const providers = {
  services: [],

  configure(container: Container): void {
    container.bind(CalculatorService).toSelf().inTransientScope();

    container
      .bind<CalculatorFactoryType>(SERVICE_TOKENS.CalculatorFactory)
      .toFactory((context: ResolutionContext) => () => context.get(CalculatorService));
  },
};
```

A capability injects the factory by token and calls it inside the handler to get a fresh instance per invocation.

```ts
import { inject } from "inversify";

export class AddTool implements IMcpToolHandler {
  public constructor(
    @inject(SERVICE_TOKENS.CalculatorFactory)
    private readonly createCalculator: CalculatorFactoryType,
  ) {}

  public handler(input: AddToolInputType): AddToolOutputType {
    const calculator = this.createCalculator();

    return { result: calculator.add(input.a, input.b) };
  }
}
```

## Rules that keep wiring safe

Keep ordinary services in the services list where they are bound once as singletons. Put every non-default lifetime in the configure step and omit that service from the services list so it is bound exactly once.

Never edit framework container internals to add application logic. Routine work (capabilities, services, bindings, configuration) belongs in your application composition, not in the framework core.

Inject concrete classes directly when there is one implementation. Introduce tokens and factories only when you need alternate implementations, transient scope, or per-call freshness.

## Test services and their capabilities

Test the service in isolation with its generated spec, then test the capability by constructing it with a real service for behavior or a simple fake for edge cases.

```ts
const tool = new AddTool(new CalculatorService());

expect(tool.handler({ a: 1, b: 2 })).toEqual({ result: 3 });
```

This pattern keeps domain rules in the service spec and wiring plus delegation in the capability spec.
