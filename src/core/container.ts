import type { Newable } from "inversify";
import { Container } from "inversify";

import type { ICapabilities } from "./types";

/**
 * Application-owned service composition consumed by {@link createAppContainer}.
 *
 * `services` lists ordinary concrete service constructors that are self-bound
 * with the container's default scope. `configure` optionally performs explicit
 * custom bindings (symbol tokens, alternate implementations, transient or
 * factory bindings) that a default self-binding cannot express.
 */
export interface IProviderConfiguration {
  readonly services: readonly Newable<unknown>[];
  readonly configure?: (container: Container) => void;
}

/**
 * Binds each listed capability constructor to itself.
 *
 * @param container - Container to bind into.
 * @param constructors - Capability constructors to self-bind.
 */
function bindCapabilities<T>(container: Container, constructors: readonly Newable<T>[]): void {
  for (const capabilityConstructor of constructors) {
    container.bind(capabilityConstructor).toSelf();
  }
}

/**
 * Creates one application container per server.
 *
 * Services are bound first, the optional custom binding callback runs second,
 * and capability constructors are bound last so an override can replace a
 * service before a capability resolves it. The default scope is singleton, so
 * normal bindings are shared within this container and isolated across server
 * instances. The function contains no application service imports.
 *
 * @param capabilityTypes - Explicit capability constructor lists.
 * @param providers - Application-owned provider configuration.
 * @returns A configured {@link Container}.
 */
export function createAppContainer(capabilityTypes: ICapabilities, providers: IProviderConfiguration): Container {
  const container = new Container({ defaultScope: "Singleton" });

  for (const service of providers.services) {
    container.bind(service).toSelf();
  }

  providers.configure?.(container);

  bindCapabilities(container, capabilityTypes.tools);

  bindCapabilities(container, capabilityTypes.prompts);

  bindCapabilities(container, capabilityTypes.resources);

  return container;
}
