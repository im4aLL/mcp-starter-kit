import type { z } from "zod";

import type { JsonObject } from "./json.types";

/**
 * MCP metadata owned by the `@tool` decorator.
 *
 * The schema parameters preserve the schema-to-handler relationship at the
 * authoring site while the resolved runtime copy is stored with defaults.
 */
export interface IToolMetadata<
  TInputSchema extends z.ZodType = z.ZodType,
  TOutputSchema extends z.ZodType<JsonObject> = z.ZodType<JsonObject>,
> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TInputSchema;
  readonly outputSchema: TOutputSchema;
}
