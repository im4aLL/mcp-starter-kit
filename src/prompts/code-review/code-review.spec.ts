import { describe, expect, it } from "vitest";

import { CodeReviewPrompt } from "./code-review";
import { CodeReviewPromptArgsSchema } from "./code-review.schemas";

describe("CodeReviewPromptArgsSchema", () => {
  it("accepts a code string", () => {
    expect(CodeReviewPromptArgsSchema.safeParse({ code: "const x = 1;" }).success).toBe(true);
  });

  it("rejects a missing code", () => {
    expect(CodeReviewPromptArgsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string code", () => {
    expect(CodeReviewPromptArgsSchema.safeParse({ code: 123 }).success).toBe(false);
  });
});

describe("CodeReviewPrompt handler", () => {
  it("builds the review instruction from the supplied code", () => {
    const codeReviewPrompt = new CodeReviewPrompt();

    expect(codeReviewPrompt.handler({ code: "const x = 1;" })).toBe("Review the following code:\n\nconst x = 1;");
  });
});
