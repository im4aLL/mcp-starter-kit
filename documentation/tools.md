---
outline: deep
---

# Tools

A tool is a model-callable function. The model sends validated JSON input, your handler runs, and the server returns structured output. Use tools for actions and computations such as calculating, looking up records, or transforming data.

## How a tool works

Each tool is one class with a `@tool` decorator that declares its MCP name, human-readable description, input schema, and output schema. The handler method receives validated input and returns the result.

Input and output schemas are Zod object schemas. The output schema must describe an object (not a bare string or number) because MCP structured tool output is object-shaped. TypeScript types derive from those schemas with `z.output`, so your handler signature always matches the advertised contract.

The `@tool` decorator already applies dependency-injection metadata, so do not add a separate injectable decorator to a tool class.

## Create a tool

Generate the scaffold first. This example uses a `multiply` tool.

```sh
npm run generate tool multiply
```

Define the contract in the generated schemas file. Keep schemas transform-free when you can so the validated input equals the raw input.

```ts
import { z } from "zod";

export const MultiplyToolInputSchema = z.object({
  a: z.number(),
  b: z.number(),
});

export const MultiplyToolOutputSchema = z.object({
  result: z.number(),
});
```

Derive the handler types from those schemas in the generated types file.

```ts
import type { z } from "zod";
import type { MultiplyToolInputSchema, MultiplyToolOutputSchema } from "./multiply-tool.schemas";

export type MultiplyToolInputType = z.output<typeof MultiplyToolInputSchema>;
export type MultiplyToolOutputType = z.output<typeof MultiplyToolOutputSchema>;
```

Decorate the class and implement the handler.

```ts
import { tool } from "../../core/decorators";
import type { IMcpToolHandler } from "../../core/types";
import { MultiplyToolInputSchema, MultiplyToolOutputSchema } from "./multiply-tool.schemas";
import type { MultiplyToolInputType, MultiplyToolOutputType } from "./multiply-tool.types";

@tool({
  name: "multiply",
  description: "Multiplies two numbers together.",
  inputSchema: MultiplyToolInputSchema,
  outputSchema: MultiplyToolOutputSchema,
})
export class MultiplyTool implements IMcpToolHandler {
  public handler(input: MultiplyToolInputType): MultiplyToolOutputType {
    return {
      result: input.a * input.b,
    };
  }
}
```

Register the constructor in the capability registry function `getCapabilityTypes()` under the tools list. The server exposes only what that function returns.

## Use a service inside a tool

Most real tools delegate to shared logic instead of implementing everything inline. Inject a concrete service class through the constructor.

```ts
import { inject } from "inversify";

import { CalculatorService } from "../../services/calculator-service";

export class AddTool implements IMcpToolHandler {
  public constructor(
    @inject(CalculatorService)
    private readonly calculator: CalculatorService,
  ) {}

  public handler(input: AddToolInputType): AddToolOutputType {
    return {
      result: this.calculator.add(input.a, input.b),
    };
  }
}
```

The service itself must be listed in the provider configuration object `providers` unless it uses a custom binding. See [Services and Injection](/services) for lifetimes and factories.

## Learn from the sample

Your scaffolded project ships with an `add` tool that adds two numbers through a shared calculator service. It is the best reference for the full pattern: Zod schemas for `{ a, b }` input and `{ result }` output, derived types, a `@tool` decorator with name and description, constructor injection, and a handler that delegates to the service.

## Test a tool

Every generated tool ships with a spec that checks the schemas and the handler directly. Follow the same shape for your own tools: assert that valid input parses, invalid input is rejected, output stays object-shaped, and the handler returns the expected result.

```ts
import { describe, expect, it } from "vitest";

describe("MultiplyTool schemas", () => {
  it("accepts numeric operands", () => {
    expect(MultiplyToolInputSchema.safeParse({ a: 2, b: 3 }).success).toBe(true);
  });

  it("rejects missing operands", () => {
    expect(MultiplyToolInputSchema.safeParse({ a: 2 }).success).toBe(false);
  });
});

describe("MultiplyTool handler", () => {
  it("multiplies validated operands", () => {
    const tool = new MultiplyTool();

    expect(tool.handler({ a: 2, b: 3 })).toEqual({ result: 6 });
  });
});
```

Run the listing to confirm the tool is registered, then run the test suite.

```sh
npm run list:capabilities
npm test
```

## Tool checklist

Choose a stable MCP name because clients and models remember it. Write a one-sentence description that tells the model when to call the tool. Keep the output schema object-shaped. Derive types from schemas instead of hand-writing them. Register the constructor, otherwise the tool exists in code but stays invisible to clients.
