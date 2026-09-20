import { prompt } from "../../core/decorators";
import type { IMcpPromptHandler } from "../../core/types";
import { CodeReviewPromptArgsSchema } from "./code-review.schemas";
import type { CodeReviewPromptArgs } from "./code-review.types";

/**
 * Builds a prompt requesting a code review.
 */
@prompt({
  name: "code_review",
  description: "Requests a focused review of the supplied code.",
  argsSchema: CodeReviewPromptArgsSchema,
  role: "user",
})
export class CodeReviewPrompt implements IMcpPromptHandler {
  /**
   * Builds the code-review instruction.
   *
   * @param args - Validated prompt arguments.
   * @returns The prompt text.
   */
  public handler(args: CodeReviewPromptArgs): string {
    return `Review the following code:\n\n${args.code}`;
  }
}
