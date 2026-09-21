---
outline: deep
---

# Generating Capabilities

The generator creates a working, convention-compliant starting point for every new piece of your server. You generate, implement the handler, register the result, and test.

## What the generator does

The generator writes starter classes with correct decorator usage, Zod schemas, derived TypeScript types, and passing tests. It never overwrites an existing file, never registers the new class for you, and never edits your capability registry or service configuration.

That split is intentional: generation is safe to rerun, and registration stays an explicit decision you make in code.

## Generate a tool, resource, prompt, or service

Run the generator from your project folder with a kind and a base name.

```sh
npm run generate tool multiply
npm run generate resource status
npm run generate prompt greet
npm run generate service inventory
```

Each command prints the files it created. A capability creates four files (class, schemas, types, spec) inside a folder named after the capability. A service creates two files (class and spec).

Preview before writing with dry-run. Nothing is created and collisions are still reported.

```sh
npm run generate tool multiply --dry-run
```

::: tip
Use dry-run when you are unsure about nesting or naming. It shows exactly which files would be created.
:::

## Naming rules

Use a kebab-case base name without the kind suffix. The generator appends the suffix for you.

Good inputs are `multiply`, `order-status`, and `code-review`. Do not pass `multiply-tool` because the generator rejects a base name that already ends with its kind.

The last path segment is the base name and earlier segments become folders. Use slash-separated paths to group related capabilities.

```sh
npm run generate tool billing/multiply
npm run generate resource github/status
npm run generate prompt code/review
npm run generate service billing/invoice
```

For example, generating a nested tool named `billing/multiply` creates a `multiply-tool` folder under a `billing` group with all four starter files inside.

Generated class, schema, and type names also append the kind. For example, a base name of `status` with kind `resource` produces a class named `StatusResource` and a schema named `StatusResourceSchema`.

MCP names for tools and prompts convert hyphens to underscores, so a base name of `order-status` is advertised as `order_status`.

## After generating: the three-step finish

Generation alone does not expose anything to MCP clients. Every new capability needs the same finish.

First, implement the handler by editing the generated schemas and class. The templates start with a placeholder string field so the tests pass immediately; replace that placeholder with your real contract.

Second, register the new class constructor in the capability registry function `getCapabilityTypes()`. There is no hidden registry and no source scan, so a generated class stays invisible until you list it there. If the capability needs shared logic, also add its service to the provider configuration object `providers`.

Third, verify with the listing, typecheck, and tests.

```sh
npm run list:capabilities
npm run typecheck
npm test
```

## End-to-end example

This example adds a `multiply` tool from scratch.

Generate the scaffold and preview it first if you like.

```sh
npm run generate tool multiply --dry-run
npm run generate tool multiply
```

Open the generated schemas file and replace the placeholder with your real inputs and outputs.

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

Implement the handler in the generated class file.

```ts
public handler(input: MultiplyToolInputType): MultiplyToolOutputType {
  return {
    result: input.a * input.b,
  };
}
```

Register the constructor in `getCapabilityTypes()` alongside the samples, then verify.

```sh
npm run list:capabilities
npm test
```

Your new tool now appears next to the samples. Delete the samples once you no longer need them and remove them from the registry.

## Safety behavior

The generator refuses to overwrite anything. If any planned file already exists, it aborts with the list of collisions and writes nothing.

If a write fails halfway, it removes the files and folders it just created so you never keep a partial scaffold.

Template content lives in editable template files. When your team changes a convention, update the templates once and every future scaffold follows the new shape.

Stuck on an error? See [Troubleshooting](/troubleshooting) for every generator failure and its fix.
