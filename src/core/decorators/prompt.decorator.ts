import type { Newable } from "inversify";
import { injectable } from "inversify";
import type { z } from "zod";

import { assertNotDecorated, getStoredCapabilityMetadata, storeCapabilityMetadata } from "../capability-metadata";
import type { IPromptMetadata } from "../types";
import type { IStoredPromptCapabilityMetadata, PromptDecoratorTargetType } from "./decorators.types";

/**
 * Marks a class as an MCP prompt and applies Inversify injectable metadata.
 *
 * The decorator stores immutable metadata directly on the constructor, never
 * replaces the constructor, mutates the prototype, binds, registers, scans, or
 * inherits metadata. It applies Inversify's bare `injectable()` without
 * selecting a scope; scope remains a container-binding decision.
 *
 * @param metadata - Decorator-owned prompt name, description, argument schema, and string-shortcut role.
 * @returns A class decorator constrained to a compatible prompt handler.
 */
export function prompt<TArgsSchema extends z.ZodType>(
  metadata: IPromptMetadata<TArgsSchema>,
): (target: PromptDecoratorTargetType<TArgsSchema>) => void {
  return (target) => {
    assertNotDecorated(target);

    const stored: IStoredPromptCapabilityMetadata = Object.freeze({
      kind: "prompt",
      metadata: Object.freeze({ ...metadata }),
    });

    injectable()(target);
    storeCapabilityMetadata(target, stored);
  };
}

/**
 * Reads prompt metadata attached directly to a constructor.
 *
 * Metadata is read with `getOwnMetadata`, so a subclass never inherits a base
 * class capability by accident.
 *
 * @param target - Constructor to read.
 * @returns The prompt metadata, or `undefined` when the constructor has none.
 * @throws Error when the constructor carries a different capability decorator.
 */
export function getPromptMetadata(target: Newable<unknown>): IPromptMetadata | undefined {
  const stored = getStoredCapabilityMetadata(target);

  if (stored === undefined) {
    return undefined;
  }

  if (stored.kind !== "prompt") {
    throw new Error(`Class "${target.name}" is decorated as a ${stored.kind}, not a prompt.`);
  }

  return stored.metadata;
}
