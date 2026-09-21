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
// For per-invocation factories and other non-default lifetimes, see
// `docs/providers-usage.md`. A service with a custom binding must be OMITTED
// from `services` so it is bound exactly once, and `src/core/container.ts`
// stays generic and application-agnostic.
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;
