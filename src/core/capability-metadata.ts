import "reflect-metadata";

import type { Newable } from "inversify";

import type { StoredCapabilityMetadataType } from "./decorators/decorators.types";

// Single shared metadata key every capability decorator reads and writes.
const capabilityMetadataKey = Symbol("mcp-starter-kit.capability-metadata");

/**
 * Rejects a constructor that already carries a capability decorator.
 *
 * @param target - Constructor about to receive capability metadata.
 * @throws Error when the constructor already has capability metadata.
 */
export function assertNotDecorated(target: Newable<unknown>): void {
  const existing = getStoredCapabilityMetadata(target);

  if (existing !== undefined) {
    throw new Error(`Class "${target.name}" already has a capability decorator.`);
  }
}

/**
 * Reads raw capability metadata attached directly to a constructor.
 *
 * `getOwnMetadata` keeps a subclass from inheriting a base class capability by
 * accident.
 *
 * @param target - Constructor to read.
 * @returns The stored capability metadata, or `undefined` when there is none.
 */
export function getStoredCapabilityMetadata(target: Newable<unknown>): StoredCapabilityMetadataType | undefined {
  return Reflect.getOwnMetadata(capabilityMetadataKey, target) as StoredCapabilityMetadataType | undefined;
}

/**
 * Attaches capability metadata directly to a constructor.
 *
 * @param target - Constructor receiving the metadata.
 * @param stored - Frozen capability metadata to store.
 */
export function storeCapabilityMetadata(target: Newable<unknown>, stored: StoredCapabilityMetadataType): void {
  Reflect.defineMetadata(capabilityMetadataKey, stored, target);
}
