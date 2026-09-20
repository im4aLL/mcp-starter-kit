# 03 - Code review prompt

Status: [ ] Not started

Source: `PLAN.md` sections "Core contract", "Schema ownership", "Handler results: domain default, wire pass-through", and "Samples (easy to delete when copying)".

Depends on: [02 Project info resource](02-project-info-resource.md).

## Outcome

A client can list `code_review` and retrieve a one-message user prompt generated from a required code string.

## Implementation

- [ ] Add `src/prompts/code-review/code-review.schemas.ts` with a transform-free Zod 4 object schema requiring `code: string`.
- [ ] Add schema-derived types in `code-review.types.ts` and a specifically typed `CodeReviewPrompt` class in `code-review.ts`. Give it name `code_review`, default role `user`, and a pure handler returning the review instruction string.
- [ ] Add specific and erased prompt contracts to `src/core/types.ts`, parameterized by the argument schema object and using `z.output` for handler arguments.
- [ ] Extend `getCapabilities()` with a fresh prompt instance and register its description, argument schema, and callback through the core registration boundary.
- [ ] Forward the SDK callback's second argument unchanged to `handler(args, extra)` and do not call `.parse()` in core.
- [ ] Extend `map-results.ts` so a string prompt result becomes one text message using the capability role, defaulting to `user`.
- [ ] Add schema, handler, mapper, and registration specs, including SDK rejection of missing or invalid `code` before handler execution.
- [ ] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [ ] MCP discovery exposes exactly one prompt named `code_review` with its description and argument schema.
- [ ] A valid retrieval returns one user message with text containing the supplied code and review instruction.
- [ ] Missing or invalid code is rejected by the SDK before `CodeReviewPrompt.handler` runs.
- [ ] The core does not treat the sample's role as a restriction on future mixed-role SDK message results.

## Verification

- [ ] Run lint, tests, and build.
- [ ] Use Inspector or a real SDK client to list `code_review` and retrieve it with a representative code snippet.
- [ ] Inspect the returned message role, content type, and text.
- [ ] Request the prompt with invalid arguments and verify schema failure plus noninvocation of the handler.

## Deliberately deferred

Mixed-role and nontext prompt implementation, generalized prompt formatting, complete wire-result pass-through tests, transformed-schema contract proof, signal handling, and final README instructions.
