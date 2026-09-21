import type { Newable } from "inversify";

import { getPromptMetadata, getResourceMetadata, getToolMetadata } from "./decorators";
import type {
  ICapabilities,
  ICapabilityMetadataRow,
  IListedCapabilities,
  IMcpPromptHandler,
  IMcpResourceHandler,
  IMcpToolHandler,
  IPromptMetadata,
  IResourceMetadata,
  IToolMetadata,
} from "./types";

// Canonical capability type order used by metadata listing.
const capabilityTypeOrder = ["tool", "resource", "prompt"] as const;

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
 * Rejects an identifier reused across listed capability metadata.
 *
 * Identifiers come from decorator metadata, so two distinct classes that
 * declare the same tool name, prompt name, or resource URI fail at composition
 * time instead of shadowing each other on the wire.
 *
 * @param label - Human-readable identifier label used in the error message.
 * @param identifiers - Listed identifiers to check.
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
 * Reads and validates decorator metadata for every listed constructor.
 *
 * Metadata is read and identifiers are checked for uniqueness before any
 * instance is resolved, so a misconfigured capability fails at composition time
 * without constructing any listed class. The function never creates a
 * container and never invokes a constructor.
 *
 * @param capabilityTypes - Explicit capability constructor lists.
 * @returns Validated metadata paired with each listed constructor.
 * @throws Error when a listed constructor lacks its decorator, carries a
 * different capability decorator, or duplicates another capability identifier.
 */
export function readCapabilityMetadata(capabilityTypes: ICapabilities): IListedCapabilities {
  const tools = capabilityTypes.tools.map((toolConstructor) => ({
    metadata: requireToolMetadata(toolConstructor),
    toolConstructor,
  }));
  const prompts = capabilityTypes.prompts.map((promptConstructor) => ({
    metadata: requirePromptMetadata(promptConstructor),
    promptConstructor,
  }));
  const resources = capabilityTypes.resources.map((resourceConstructor) => ({
    metadata: requireResourceMetadata(resourceConstructor),
    resourceConstructor,
  }));

  assertUniqueIdentifiers(
    "tool name",
    tools.map((entry) => entry.metadata.name),
  );

  assertUniqueIdentifiers(
    "prompt name",
    prompts.map((entry) => entry.metadata.name),
  );

  assertUniqueIdentifiers(
    "resource URI",
    resources.map((entry) => entry.metadata.uri),
  );

  return { tools, prompts, resources };
}

/**
 * Orders metadata rows by capability type, then by name.
 *
 * @param left - First row to compare.
 * @param right - Second row to compare.
 * @returns A negative number, zero, or a positive number per sort contract.
 */
function compareMetadataRows(left: ICapabilityMetadataRow, right: ICapabilityMetadataRow): number {
  const typeDifference = capabilityTypeOrder.indexOf(left.type) - capabilityTypeOrder.indexOf(right.type);

  if (typeDifference !== 0) {
    return typeDifference;
  }

  if (left.name < right.name) {
    return -1;
  }

  if (left.name > right.name) {
    return 1;
  }

  return 0;
}

/**
 * Builds printable metadata rows for every listed constructor.
 *
 * This is the container-free listing path: it reads decorator metadata through
 * the same validation used by runtime resolution and never creates a
 * container, resolves a constructor, or starts a transport.
 *
 * @param capabilityTypes - Explicit capability constructor lists.
 * @returns Metadata rows in deterministic type and name order.
 * @throws Error when a listed constructor lacks its decorator, carries a
 * different capability decorator, or duplicates another capability identifier.
 */
export function listCapabilityMetadata(capabilityTypes: ICapabilities): readonly ICapabilityMetadataRow[] {
  const listed = readCapabilityMetadata(capabilityTypes);
  const rows: ICapabilityMetadataRow[] = [
    ...listed.tools.map((entry) => ({
      type: "tool" as const,
      name: entry.metadata.name,
      identifier: entry.metadata.name,
      description: entry.metadata.description,
    })),
    ...listed.resources.map((entry) => ({
      type: "resource" as const,
      name: entry.metadata.name,
      identifier: entry.metadata.uri,
      description: entry.metadata.description,
    })),
    ...listed.prompts.map((entry) => ({
      type: "prompt" as const,
      name: entry.metadata.name,
      identifier: entry.metadata.name,
      description: entry.metadata.description,
    })),
  ];

  return rows.toSorted(compareMetadataRows);
}
