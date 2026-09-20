# 03 - Code review prompt

Status: [ ] Not started

Source: `PLAN.md` sections "Core contract", "Schema ownership", "Handler results: domain default, wire pass-through", "Decorated capability constructors and resolved collections", and "Samples (easy to delete when copying)".

Depends on: [02 Project info resource](02-project-info-resource.md).

## Outcome

A client can list `code_review` and retrieve a one-message user prompt generated from a required code string. Prompt metadata and its argument schema live on the decorated constructor, while the prompt instance is created by the per-server container.

## Target shape

```ts
/**
 * Builds a prompt requesting a code review.
 */
@prompt({
  name: "code_review",
  description: "Requests a focused review of the supplied code.",
  argsSchema: CodeReviewPromptArgsSchema,
  role: "user",
})
export class CodeReviewPrompt implements McpPromptHandler {
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
```

Registration remains explicit:

```ts
/**
 * Returns the capability constructors registered by the application.
 *
 * @returns Explicit tool, prompt, and resource constructor lists.
 */
export function getCapabilityTypes(): CapabilityTypes {
  return {
    tools: [AddTool],
    prompts: [CodeReviewPrompt],
    resources: [ProjectInfoResource],
  };
}
```

## Implementation

- [ ] Add `src/prompts/code-review/code-review.schemas.ts` with a transform-free Zod 4 object schema requiring `code: string`.
- [ ] Add the schema-derived `CodeReviewPromptArgs` type in `code-review.types.ts`.
- [ ] Add non-generic prompt handler, prompt metadata, constructor-list, and resolved-prompt contracts to `src/core/types.ts`. Handler arguments remain schema-specific through the class method annotation and typed decorator constraint rather than a generic implements clause.
- [ ] Add a typed `@prompt` decorator and direct metadata reader to `src/core/decorators.ts`. Have `@prompt` apply Inversify's `injectable()` metadata internally, constrain the decorated handler to accept `z.output<TArgsSchema>` and an allowed prompt result, and store `role` as string-shortcut metadata only.
- [ ] Add `CodeReviewPrompt` in the target shape above with only `@prompt(...)`, `implements McpPromptHandler`, and an explicitly annotated schema-derived handler argument. Do not repeat `@injectable()` on the capability class.
- [ ] Extend `getCapabilityTypes()` with `CodeReviewPrompt`, bind the listed prompt constructor in the per-server container, resolve it through the common resolver, and register its decorator-owned description, argument schema, role, and callback.
- [ ] Forward the SDK callback's second argument unchanged to the resolved instance's `handler(args, extra)` and do not call `.parse()` in core.
- [ ] Extend `map-results.ts` so a string prompt result becomes one text message using the decorator metadata role, defaulting to `user`.
- [ ] Add schema, handler, decorator metadata, container resolution, mapper, and registration specs, including SDK rejection of missing or invalid `code` before handler execution.
- [ ] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [ ] MCP discovery exposes exactly one prompt named `code_review` with its decorator-owned description and argument schema.
- [ ] A valid retrieval returns one user message with text containing the supplied code and review instruction.
- [ ] Missing or invalid code is rejected by the SDK before `CodeReviewPrompt.handler` runs.
- [ ] The core does not treat the sample's role as a restriction on future mixed-role SDK message results.
- [ ] `CodeReviewPrompt` is explicitly listed as a constructor and resolved from the same per-server container as the tool and resource.

## Verification

- [ ] Run lint, tests, and build.
- [ ] Use Inspector or a real SDK client to list `code_review` and retrieve it with a representative code snippet.
- [ ] Inspect the returned message role, content type, and text.
- [ ] Request the prompt with invalid arguments and verify schema failure plus noninvocation of the handler.
- [ ] Confirm metadata listing does not instantiate `CodeReviewPrompt` and runtime resolution does.

## Deliberately deferred

Mixed-role and nontext prompt implementation, generalized prompt formatting, complete wire-result pass-through tests, transformed-schema contract proof, complete duplicate-identifier validation, explicit scope overrides, factory providers, signal handling, and final README instructions.
