---
outline: deep
---

# Prompts

A prompt is a reusable instruction template. The client sends validated arguments, your handler builds the prompt text, and the model receives a ready-to-use message. Use prompts for repeatable workflows such as code reviews, triage checklists, or report templates.

## How a prompt works

Each prompt is one class with a `@prompt` decorator that declares its MCP name, description, argument schema, and a default role. The handler receives validated arguments and returns the prompt string.

The `role` field is only the default for the simple string-return style. If your handler returns a full messages object instead, that object owns every message role.

The `@prompt` decorator already applies dependency-injection metadata, so do not add a separate injectable decorator to a prompt class.

## Create a prompt

Generate the scaffold first. This example uses a `greet` prompt.

```sh
npm run generate prompt greet
```

Define the arguments in the generated schemas file with Zod. Keep the schema transform-free when you can so validated arguments equal the raw input.

```ts
import { z } from "zod";

export const GreetPromptArgsSchema = z.object({
  topic: z.string(),
});
```

Derive the argument type from that schema in the generated types file, then implement the handler.

```ts
import { prompt } from "../../core/decorators";
import type { IMcpPromptHandler } from "../../core/types";
import { GreetPromptArgsSchema } from "./greet-prompt.schemas";
import type { GreetPromptArgsType } from "./greet-prompt.types";

@prompt({
  name: "greet",
  description: "Builds a greeting for the given topic.",
  argsSchema: GreetPromptArgsSchema,
  role: "user",
})
export class GreetPrompt implements IMcpPromptHandler {
  public handler(args: GreetPromptArgsType): string {
    return `Explain the following topic:\n\n${args.topic}`;
  }
}
```

Register the constructor in the capability registry function `getCapabilityTypes()` under the prompts list. MCP names convert hyphens to underscores, so a base name of `code-review` is advertised as `code_review`.

## Learn from the sample

Your scaffolded project ships with a code-review prompt that takes a `code` string argument and returns review instructions with that code appended. It shows the full pattern: a required-string args schema, a `@prompt` decorator with name and user role, and a handler that interpolates the validated argument into template text.

## Test a prompt

Generated prompt specs check the args schema and call the handler directly. Follow that shape: assert valid arguments parse, missing arguments are rejected, and the handler output contains the supplied values.

```ts
import { describe, expect, it } from "vitest";

describe("GreetPrompt handler", () => {
  it("includes the topic in the prompt", () => {
    const prompt = new GreetPrompt();

    expect(prompt.handler({ topic: "caching" })).toContain("caching");
  });
});
```

Verify registration without starting the server.

```sh
npm run list:capabilities
```

## Prompt checklist

Choose a stable MCP name because clients reference it directly. Document the expected arguments in the description. Keep the handler output focused so the model gets clear instructions. Derive argument types from the schema. Register the constructor, otherwise the prompt stays invisible.
