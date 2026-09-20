import type { Newable } from "inversify";
import type { z } from "zod";

import type {
  IMcpResourceHandler,
  IMcpToolHandler,
  IResourceMetadata,
  IToolMetadata,
  JsonObject,
  McpRequestExtraType,
  ToolHandlerResultType,
} from "../types";

// Capability kinds recorded by capability decorators.
export type CapabilityKindType = "tool" | "resource";

// Stored tool metadata, discriminated by kind for pre-registration checks.
export interface IStoredToolCapabilityMetadata {
  readonly kind: "tool";
  readonly metadata: IToolMetadata;
}

// Stored resource metadata, discriminated by kind for pre-registration checks.
export interface IStoredResourceCapabilityMetadata {
  readonly kind: "resource";
  readonly metadata: IResourceMetadata;
}

// Union of every stored capability metadata shape.
export type StoredCapabilityMetadataType = IStoredToolCapabilityMetadata | IStoredResourceCapabilityMetadata;

/**
 * A constructor the typed `@tool` decorator accepts.
 *
 * The handler must accept `z.output<TInputSchema>` and return the allowed
 * result for `z.output<TOutputSchema>`. Constructor parameter shapes are left
 * open so constructor-injected capabilities stay assignable.
 */
export type ToolDecoratorTargetType<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType<JsonObject>,
> = Newable<
  IMcpToolHandler & {
    handler(
      input: z.output<TInputSchema>,
      extra?: McpRequestExtraType,
    ): ToolHandlerResultType<z.output<TOutputSchema>> | Promise<ToolHandlerResultType<z.output<TOutputSchema>>>;
  }
>;

/**
 * A constructor the typed `@resource` decorator accepts.
 *
 * The handler must honor the erased resource contract: a `string` or JSON
 * value result, or prebuilt SDK wire contents. Resources have no
 * schema-derived typing step, so the contract is the authoring constraint.
 */
export type ResourceDecoratorTargetType = Newable<IMcpResourceHandler>;
