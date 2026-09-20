import type { Container, Newable } from "inversify";

import { getResourceMetadata, getToolMetadata } from "./decorators";
import type {
  ICapabilities,
  IMcpResourceHandler,
  IMcpToolHandler,
  IResolvedCapabilities,
  IResolvedResource,
  IResolvedTool,
} from "./types";

/**
 * Resolves one listed tool constructor into metadata plus an instance.
 *
 * @param container - Per-server container holding the constructor binding.
 * @param toolConstructor - Tool constructor listed by the application.
 * @returns The resolved tool record.
 * @throws Error when the constructor lacks `@tool` metadata.
 */
function resolveTool(container: Container, toolConstructor: Newable<IMcpToolHandler>): IResolvedTool {
  const metadata = getToolMetadata(toolConstructor);

  if (metadata === undefined) {
    throw new Error(`Tool constructor "${toolConstructor.name}" is missing the @tool decorator.`);
  }

  const instance = container.get(toolConstructor);

  return { metadata, instance };
}

/**
 * Resolves one listed resource constructor into metadata plus an instance.
 *
 * @param container - Per-server container holding the constructor binding.
 * @param resourceConstructor - Resource constructor listed by the application.
 * @returns The resolved resource record.
 * @throws Error when the constructor lacks `@resource` metadata or carries a
 * different capability decorator.
 */
function resolveResource(container: Container, resourceConstructor: Newable<IMcpResourceHandler>): IResolvedResource {
  const metadata = getResourceMetadata(resourceConstructor);

  if (metadata === undefined) {
    throw new Error(`Resource constructor "${resourceConstructor.name}" is missing the @resource decorator.`);
  }

  const instance = container.get(resourceConstructor);

  return { metadata, instance };
}

/**
 * Resolves the listed capability constructors through a per-server container.
 *
 * Validation happens before server registration, so a misconfigured capability
 * fails at composition time rather than on first invocation. Prompt resolution
 * is deferred; a non-empty prompt list is rejected explicitly instead of being
 * silently dropped.
 *
 * @param container - Per-server container to resolve from.
 * @param capabilityTypes - Explicit capability constructor lists.
 * @returns Resolved runtime capabilities for registration.
 * @throws Error when a listed constructor lacks its decorator or an
 * unimplemented capability kind is listed.
 */
export function resolveCapabilities(container: Container, capabilityTypes: ICapabilities): IResolvedCapabilities {
  if (capabilityTypes.prompts.length > 0) {
    throw new Error("Prompt capability resolution is not implemented yet.");
  }

  const tools = capabilityTypes.tools.map((toolConstructor) => resolveTool(container, toolConstructor));
  const resources = capabilityTypes.resources.map((resourceConstructor) =>
    resolveResource(container, resourceConstructor),
  );

  return { tools, resources };
}
