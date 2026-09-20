import { z } from "zod";

// Prompt argument schema: a required code string. Transform-free so input equals output.
export const CodeReviewPromptArgsSchema = z.object({
  code: z.string(),
});
