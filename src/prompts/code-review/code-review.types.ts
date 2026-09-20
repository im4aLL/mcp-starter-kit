import type { z } from "zod";

import type { CodeReviewPromptArgsSchema } from "./code-review.schemas";

// Schema-derived prompt argument type.
export type CodeReviewPromptArgs = z.output<typeof CodeReviewPromptArgsSchema>;
