import type { Container } from "inversify";

import { readCapabilityMetadata } from "./list-capability-metadata";
import type { ICapabilities, IResolvedCapabilities } from "./types";

/**
 * Resolves the listed capability constructors through a per-server container.
 *
 * Metadata for every listed constructor is read, and identifiers are checked
 * for uniqueness, before any instance is resolved. A misconfigured capability
 * therefore fails at composition time without constructing any listed class.
 *
 * @param container - Per-server container to resolve from.
 * @param capabilityTypes - Explicit capability constructor lists.
 * @returns Resolved runtime capabilities for registration.
 * @throws Error when a listed constructor lacks its decorator, carries a
 * different capability decorator, or duplicates another capability identifier.
 */
export function resolveCapabilities(container: Container, capabilityTypes: ICapabilities): IResolvedCapabilities {
  const listed = readCapabilityMetadata(capabilityTypes);

  const tools = listed.tools.map(({ metadata, toolConstructor }) => ({
    metadata,
    instance: container.get(toolConstructor),
  }));
  const prompts = listed.prompts.map(({ metadata, promptConstructor }) => ({
    metadata,
    instance: container.get(promptConstructor),
  }));
  const resources = listed.resources.map(({ metadata, resourceConstructor }) => ({
    metadata,
    instance: container.get(resourceConstructor),
  }));

  return { tools, prompts, resources };
}
