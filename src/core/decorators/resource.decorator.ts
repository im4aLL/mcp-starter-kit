import type { Newable } from "inversify";
import { injectable } from "inversify";

import { assertNotDecorated, getStoredCapabilityMetadata, storeCapabilityMetadata } from "../capability-metadata";
import type { IResourceMetadata } from "../types";
import type { IStoredResourceCapabilityMetadata, ResourceDecoratorTargetType } from "./decorators.types";

/**
 * Marks a class as an MCP resource and applies Inversify injectable metadata.
 *
 * The decorator stores immutable metadata directly on the constructor, never
 * replaces the constructor, mutates the prototype, binds, registers, scans, or
 * inherits metadata. It applies Inversify's bare `injectable()` without
 * selecting a scope; scope remains a container-binding decision.
 *
 * @param metadata - Decorator-owned resource URI, name, description, and listing MIME hint.
 * @returns A class decorator constrained to the erased resource handler contract.
 */
export function resource(metadata: IResourceMetadata): (target: ResourceDecoratorTargetType) => void {
  return (target) => {
    assertNotDecorated(target);

    const stored: IStoredResourceCapabilityMetadata = Object.freeze({
      kind: "resource",
      metadata: Object.freeze({ ...metadata }),
    });

    injectable()(target);
    storeCapabilityMetadata(target, stored);
  };
}

/**
 * Reads resource metadata attached directly to a constructor.
 *
 * Metadata is read with `getOwnMetadata`, so a subclass never inherits a base
 * class capability by accident.
 *
 * @param target - Constructor to read.
 * @returns The resource metadata, or `undefined` when the constructor has none.
 * @throws Error when the constructor carries a different capability decorator.
 */
export function getResourceMetadata(target: Newable<unknown>): IResourceMetadata | undefined {
  const stored = getStoredCapabilityMetadata(target);

  if (stored === undefined) {
    return undefined;
  }

  if (stored.kind !== "resource") {
    throw new Error(`Class "${target.name}" is decorated as a ${stored.kind}, not a resource.`);
  }

  return stored.metadata;
}
