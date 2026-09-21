import type { IProviderConfiguration } from "./core/container";
import { CalculatorService } from "./services/calculator-service";

// Application-owned service composition.
//
// `services` lists ordinary concrete services that generic core container code
// self-binds with the container's default singleton scope, so adding a service
// does not require editing `src/core/container.ts`. `AddTool` injects
// `CalculatorService` directly; a transient constructor dependency is new per
// capability resolution, not per `handler()` call.
//
// For per-invocation factories and other non-default lifetimes, see below.
// A service with a custom binding must be OMITTED
// from `services` so it is bound exactly once, and `src/core/container.ts`
// stays generic and application-agnostic.
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;

/*
Provider and lifetime usage

`src/providers.ts` is the application-owned composition root. It lists ordinary concrete services and can supply custom bindings for lifetimes a default self-binding cannot express. `src/core/container.ts` stays generic and application-agnostic, so add or replace application services and dependencies only in `src/providers.ts`.

The runtime sample keeps the simple shape:

```ts
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;
```

## Lifetimes at a glance

- Ordinary services in `services`: bound to themselves with the container default scope of singleton, so one instance is shared by every tool, prompt, and resource within a single application container. Every `createAppServer()` call creates a new container, so those singletons are isolated across server instances.
- Direct transient injection: bind the service with `.inTransientScope()`. A transient constructor dependency is new per capability resolution, not per `handler()` call.
- Injected factory: bind a factory with Inversify `toFactory`. The factory can create a new transient service on every `handler()` invocation.

## Per-invocation factory

Use this when a capability needs a fresh dependency for each handler call. Copy the example, paste it into `src/providers.ts`, and adjust the names. The service is omitted from `services` because it has a custom binding and must be bound exactly once.

```ts
import type { Container, ResolutionContext } from "inversify";

import type { IProviderConfiguration } from "./core/container";
import { CalculatorService } from "./services/calculator-service";

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
} satisfies IProviderConfiguration;
```

A capability injects the factory by token and calls it inside `handler()`:

```ts
import { inject } from "inversify";

import type { IMcpToolHandler } from "./core/types";
import type { AddToolInputType, AddToolOutputType } from "./tools/add-tool/add-tool.types";

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

## Rules

- Keep ordinary services in `services`; they are self-bound singleton.
- Put every non-default lifetime in `configure`, and omit that service from `services` so it is bound exactly once.
- Never edit `src/core/container.ts` to add or change an application service.
- The runtime sample uses direct `CalculatorService` injection; the factory pattern is an opt-in example, not a second runtime `add` capability.
*/
