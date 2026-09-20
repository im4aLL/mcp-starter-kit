import type { z } from "zod";

import type { AddToolInputSchema, AddToolOutputSchema } from "./add-tool.schemas";

// Schema-derived tool input type.
export type AddToolInputType = z.output<typeof AddToolInputSchema>;

// Schema-derived tool output type.
export type AddToolOutputType = z.output<typeof AddToolOutputSchema>;
