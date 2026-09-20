import type { IProviderConfiguration } from "./core/container";
import { CalculatorService } from "./services/calculator-service";

// Application-owned service composition: ordinary concrete services are
// self-bound by generic core container code, so adding one does not require
// editing `src/core/container.ts`.
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;
