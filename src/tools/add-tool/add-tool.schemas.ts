import { z } from "zod";

// Tool input schema: two numeric operands. Transform-free so input equals output.
export const AddToolInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

// Tool output schema: object-shaped because structured tool output is an object.
export const AddToolOutputSchema = z.object({
  result: z.number(),
});
