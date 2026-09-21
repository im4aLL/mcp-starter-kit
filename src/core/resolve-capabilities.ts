import type { Container, Newable } from "inversify";

import { getPromptMetadata, getResourceMetadata, getToolMetadata } from "./decorators";
import type {
  ICapabilities,
  IMcpPromptHandler,
  IMcpResourceHandler,
  IMcpToolHandler,
  IPromptMetadata,
  IResolvedCapabilities,
  IResourceMetadata,
  IToolMetadata,
} from "./types";

/**
 * Reads the required `@tool` metadata for one listed constructor.
 *
 * @param toolConstructor - Tool constructor listed by the application.
 * @returns The decorator-owned tool metadata.
 * @throws Error when the constructor lacks `@tool` metadata or carries a
 * different capability decorator.
 */
function requireToolMetadata(toolConstructor: Newable<IMcpToolHandler>): IToolMetadata {
  const metadata = getToolMetadata(toolConstructor);

  if (metadata === undefined) {
    throw new Error(`Tool constructor "${toolConstructor.name}" is missing the @tool decorator.`);
  }

  return metadata;
}

/**
 * Reads the required `@resource` metadata for one listed constructor.
 *
 * @param resourceConstructor - Resource constructor listed by the application.
 * @returns The decorator-owned resource metadata.
 * @throws Error when the constructor lacks `@resource` metadata or carries a
 * different capability decorator.
 */
function requireResourceMetadata(resourceConstructor: Newable<IMcpResourceHandler>): IResourceMetadata {
  const metadata = getResourceMetadata(resourceConstructor);

  if (metadata === undefined) {
    throw new Error(`Resource constructor "${resourceConstructor.name}" is missing the @resource decorator.`);
  }

  return metadata;
}

/**
 * Reads the required `@prompt` metadata for one listed constructor.
 *
 * @param promptConstructor - Prompt constructor listed by the application.
 * @returns The decorator-owned prompt metadata.
 * @throws Error when the constructor lacks `@prompt` metadata or carries a
 * different capability decorator.
 */
function requirePromptMetadata(promptConstructor: Newable<IMcpPromptHandler>): IPromptMetadata {
  const metadata = getPromptMetadata(promptConstructor);

  if (metadata === undefined) {
    throw new Error(`Prompt constructor "${promptConstructor.name}" is missing the @prompt decorator.`);
  }

  return metadata;
}

/**
 * Rejects an identifier reused across resolved capability metadata.
 *
 * Identifiers come from decorator metadata, so two distinct classes that
 * declare the same tool name, prompt name, or resource URI fail at composition
 * time instead of shadowing each other on the wire.
 *
 * @param label - Human-readable identifier label used in the error message.
 * @param identifiers - Resolved identifiers to check.
 * @throws Error when an identifier appears more than once.
 */
function assertUniqueIdentifiers(label: string, identifiers: readonly string[]): void {
  const seen = new Set<string>();

  for (const identifier of identifiers) {
    if (seen.has(identifier)) {
      throw new Error(`Duplicate ${label} "${identifier}": each listed capability must have a unique identifier.`);
    }

    seen.add(identifier);
  }
}

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
  const toolEntries = capabilityTypes.tools.map((toolConstructor) => ({
    metadata: requireToolMetadata(toolConstructor),
    toolConstructor,
  }));
  const promptEntries = capabilityTypes.prompts.map((promptConstructor) => ({
    metadata: requirePromptMetadata(promptConstructor),
    promptConstructor,
  }));
  const resourceEntries = capabilityTypes.resources.map((resourceConstructor) => ({
    metadata: requireResourceMetadata(resourceConstructor),
    resourceConstructor,
  }));

  assertUniqueIdentifiers(
    "tool name",
    toolEntries.map((entry) => entry.metadata.name),
  );

  assertUniqueIdentifiers(
    "prompt name",
    promptEntries.map((entry) => entry.metadata.name),
  );

  assertUniqueIdentifiers(
    "resource URI",
    resourceEntries.map((entry) => entry.metadata.uri),
  );

  const tools = toolEntries.map(({ metadata, toolConstructor }) => ({
    metadata,
    instance: container.get(toolConstructor),
  }));
  const prompts = promptEntries.map(({ metadata, promptConstructor }) => ({
    metadata,
    instance: container.get(promptConstructor),
  }));
  const resources = resourceEntries.map(({ metadata, resourceConstructor }) => ({
    metadata,
    instance: container.get(resourceConstructor),
  }));

  return { tools, prompts, resources };
}
