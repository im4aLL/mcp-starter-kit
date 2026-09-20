import type { z } from "zod";

/**
 * MCP metadata owned by the `@prompt` decorator.
 *
 * `role` is the default role for the string-return shortcut only. It is not a
 * prompt-wide constraint: a handler that returns `{ messages }` owns every
 * message role.
 */
export interface IPromptMetadata<TArgsSchema extends z.ZodType = z.ZodType> {
  readonly name: string;
  readonly description: string;
  readonly argsSchema: TArgsSchema;
  readonly role?: "user" | "assistant";
}
