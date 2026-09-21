import type { z } from "zod";

import type { CodeReviewPromptArgsSchema } from "./code-review.schemas";

// Schema-derived prompt argument type.
export type CodeReviewPromptArgsType = z.output<typeof CodeReviewPromptArgsSchema>;
