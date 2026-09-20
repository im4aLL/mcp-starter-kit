import type { Newable } from "inversify";
import type { z } from "zod";

import type { IMcpToolHandler, IToolMetadata, JsonObject, McpRequestExtraType, ToolHandlerResultType } from "../types";

// Capability kinds recorded by capability decorators.
export type CapabilityKindType = "tool";

// Stored capability metadata, discriminated by kind for pre-registration checks.
export interface IStoredCapabilityMetadata {
  readonly kind: CapabilityKindType;
  readonly metadata: IToolMetadata;
}

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
