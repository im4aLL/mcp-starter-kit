import type { Newable } from "inversify";
import { injectable } from "inversify";
import type { z } from "zod";

import { assertNotDecorated, getStoredCapabilityMetadata, storeCapabilityMetadata } from "../capability-metadata";
import type { IToolMetadata, JsonObject } from "../types";
import type { IStoredCapabilityMetadata, ToolDecoratorTargetType } from "./decorators.types";

/**
 * Marks a class as an MCP tool and applies Inversify injectable metadata.
 *
 * The decorator stores immutable metadata directly on the constructor, never
 * replaces the constructor, mutates the prototype, binds, registers, scans, or
 * inherits metadata. It applies Inversify's bare `injectable()` without
 * selecting a scope; scope remains a container-binding decision.
 *
 * @param metadata - Decorator-owned tool name, description, and schemas.
 * @returns A class decorator constrained to compatible handler signatures.
 */
export function tool<TInputSchema extends z.ZodType, TOutputSchema extends z.ZodType<JsonObject>>(
  metadata: IToolMetadata<TInputSchema, TOutputSchema>,
): (target: ToolDecoratorTargetType<TInputSchema, TOutputSchema>) => void {
  return (target) => {
    assertNotDecorated(target);

    const stored: IStoredCapabilityMetadata = Object.freeze({
      kind: "tool",
      metadata: Object.freeze({ ...metadata }),
    });

    injectable()(target);
    storeCapabilityMetadata(target, stored);
  };
}

/**
 * Reads tool metadata attached directly to a constructor.
 *
 * Metadata is read with `getOwnMetadata`, so a subclass never inherits a base
 * class capability by accident.
 *
 * @param target - Constructor to read.
 * @returns The tool metadata, or `undefined` when the constructor has none.
 * @throws Error when the constructor carries a different capability decorator.
 */
export function getToolMetadata(target: Newable<unknown>): IToolMetadata | undefined {
  const stored = getStoredCapabilityMetadata(target);

  if (stored === undefined) {
    return undefined;
  }

  if (stored.kind !== "tool") {
    throw new Error(`Class "${target.name}" is decorated as a ${stored.kind}, not a tool.`);
  }

  return stored.metadata;
}
