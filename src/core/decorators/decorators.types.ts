import type { Newable } from "inversify";
import type { z } from "zod";

import type {
  IMcpPromptHandler,
  IMcpResourceHandler,
  IMcpToolHandler,
  IPromptMetadata,
  IResourceMetadata,
  IToolMetadata,
  JsonObject,
  McpRequestExtraType,
  PromptHandlerResultType,
  ToolHandlerResultType,
} from "../types";

// Capability kinds recorded by capability decorators.
export type CapabilityKindType = "tool" | "resource" | "prompt";

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

// Stored prompt metadata, discriminated by kind for pre-registration checks.
export interface IStoredPromptCapabilityMetadata {
  readonly kind: "prompt";
  readonly metadata: IPromptMetadata;
}

// Union of every stored capability metadata shape.
export type StoredCapabilityMetadataType =
  | IStoredToolCapabilityMetadata
  | IStoredResourceCapabilityMetadata
  | IStoredPromptCapabilityMetadata;

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

/**
 * A constructor the typed `@prompt` decorator accepts.
 *
 * The handler must accept `z.output<TArgsSchema>` and return the allowed
 * prompt result: a string shortcut or already-built messages. Constructor
 * parameter shapes are left open so constructor-injected capabilities stay
 * assignable.
 */
export type PromptDecoratorTargetType<TArgsSchema extends z.ZodType> = Newable<
  IMcpPromptHandler & {
    handler(
      args: z.output<TArgsSchema>,
      extra?: McpRequestExtraType,
    ): PromptHandlerResultType | Promise<PromptHandlerResultType>;
  }
>;
