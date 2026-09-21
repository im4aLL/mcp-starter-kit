# MCP class-based starter

A copyable, class-based TypeScript starter for an MCP server that runs over stdio. It ships one example tool, resource, and prompt, keeps domain handlers separate from MCP wire mapping, and keeps the framework core application-agnostic.

This repository is a starter to duplicate, not a reusable framework package. Keep names generic, the core thin, and the sample capabilities obvious to replace.

## Prerequisites

- Node.js 20 or newer (the package declares `engines.node` as `>=20`).
- npm; the committed `package-lock.json` is authoritative.

## Copy and rename

When copying this repository into a new MCP server project:

1. Rename the `package.json` `name` and the `bin` entry, and the command you run.
2. Rename the advertised `McpServer` identity in `src/config.ts` (`serverConfig.name` and `serverConfig.version`). `MCP_SERVER_NAME` and `MCP_SERVER_VERSION` override them per launch.
3. Rename the Pino logger name if you want one different from the server name. `src/utils/logger.ts` uses `serverConfig.name`, so the server identity and logger name stay aligned by default.
4. Replace the sample `src/tools/add-tool`, `src/resources/project-info`, and `src/prompts/code-review` folders, then update `src/capabilities/capabilities.ts`.

## Install, build, and start

```sh
npm ci
npm run build
npm start
```

`npm start` runs `node dist/main.js`, the bundled ESM entry with a Node shebang. `npm run dev` runs the TypeScript directly through tsx. `npm run inspect` builds and launches the MCP Inspector.

## Generate a scaffold

`npm run generate` writes a convention-compliant starter class. It never overwrites files, never registers constructors, and never edits `src/capabilities/capabilities.ts` or `src/providers.ts`.

```sh
npm run generate tool multiply
npm run generate resource status
npm run generate prompt greet
npm run generate service inventory
```

Naming appends the kind suffix to a kebab-case base name:

| Command | Files |
| --- | --- |
| `npm run generate tool multiply` | `src/tools/multiply-tool/` with `multiply-tool.ts`, `multiply-tool.schemas.ts`, `multiply-tool.types.ts`, and `multiply-tool.spec.ts` |
| `npm run generate resource status` | `src/resources/status-resource/` with the same four-file layout |
| `npm run generate prompt greet` | `src/prompts/greet-prompt/` with the same four-file layout |
| `npm run generate service inventory` | `src/services/inventory-service.ts` and `src/services/inventory-service.spec.ts` |

Pass a slash-separated kebab-case path to nest the scaffold in subdirectories. The last segment is the base name; earlier segments become folders:

| Command | Files |
| --- | --- |
| `npm run generate tool nested/multiply` | `src/tools/nested/multiply-tool/` with the four-file layout |
| `npm run generate resource github/status` | `src/resources/github/status-resource/` with the four-file layout |
| `npm run generate prompt code/review` | `src/prompts/code/review-prompt/` with the four-file layout |
| `npm run generate service billing/invoice` | `src/services/billing/invoice-service.ts` and `src/services/billing/invoice-service.spec.ts` |

Each kind's file contents come from the templates under `scripts/templates/` (`tool.ts.template`, `tool.schemas.ts.template`, and so on). Update those files when a capability convention changes; `scripts/generate.mjs` only handles argument validation, path planning, and safe writes.

Generated capability class, schema, and type names append the kind suffix (for example `StatusResourceSchema`), a uniform rule that differs from the legacy `project-info` and `code-review` sample folders, whose names omit the suffix.

After generating a capability, import the class and add its constructor to `getCapabilityTypes()` in `src/capabilities/capabilities.ts`. After generating a service, add it to the `services` list in `src/providers.ts` if a capability should inject it. The generator does not perform those steps.

## Add a capability

Put MCP metadata and Inversify injectable metadata on a class with one project decorator, then list the constructor. There is no hidden registry and no source scan: `getCapabilityTypes()` is the only registration list.

```ts
import { tool } from "../../core/decorators";
import type { IMcpToolHandler } from "../../core/types";
import type { SomethingInputType, SomethingOutputType } from "./something.types";
import { SomethingInputSchema, SomethingOutputSchema } from "./something.schemas";

@tool({
  name: "something",
  description: "Does something.",
  inputSchema: SomethingInputSchema,
  outputSchema: SomethingOutputSchema,
})
export class SomethingTool implements IMcpToolHandler {
  public handler(input: SomethingInputType): SomethingOutputType {
    return { result: input.value };
  }
}
```

Then add `SomethingTool` to the `tools` list that `getCapabilityTypes()` returns in `src/capabilities/capabilities.ts`. Resources and prompts follow the same pattern with `@resource` and `@prompt`.

The `@tool`, `@resource`, and `@prompt` decorators already apply Inversify `injectable()` metadata, so do not add `@injectable()` to a capability class. Service classes that are not capabilities use `@injectable()` directly.

## Register services and lifetimes

`src/providers.ts` is the application-owned composition point. Ordinary concrete services go in its `services` list and are self-bound with the container's default singleton scope, so one instance is shared by every capability within a server:

```ts
export const providers = {
  services: [CalculatorService],
} satisfies IProviderConfiguration;
```

Capabilities inject concrete classes by constructor:

```ts
import { inject } from "inversify";

public constructor(
  @inject(CalculatorService)
  private readonly calculator: CalculatorService,
) {}
```

Every server gets a new container, so those singletons are isolated across server instances. A direct transient constructor dependency is new per capability resolution, not automatically per `handler()` call. To create a fresh dependency for each handler invocation, bind the service transient and inject a `toFactory` provider:

```ts
container.bind(CalculatorService).toSelf().inTransientScope();

container
  .bind<CalculatorFactoryType>(SERVICE_TOKENS.CalculatorFactory)
  .toFactory((context: ResolutionContext) => () => context.get(CalculatorService));
```

Put non-default bindings such as symbol tokens, alternate implementations, constants, transient scope, and factories in the optional `configure(container)` callback, and omit that service from `services` so it is bound exactly once. See [docs/providers-usage.md](docs/providers-usage.md) for the complete factory example.

Routine application work (capabilities, services, bindings, and configuration) never requires editing `src/core/container.ts` or any other `src/core/` file. Change `src/core/` only when intentionally changing framework behavior such as container mechanics, decorators, contracts, result mapping, registration, or transport.

## Cursor configuration

Build first, then point Cursor at the absolute built path:

```json
{
  "mcpServers": {
    "mcp-framework": {
      "command": "node",
      "args": ["/absolute/path/to/repo/dist/main.js"]
    }
  }
}
```

Cursor is more reliable with `node dist/main.js` than with npx. Rename the `mcpServers` key when you rename the package.

## Inspector

After `npm run build`:

```sh
npx @modelcontextprotocol/inspector node dist/main.js
```

## Transport scope

Stdio is the only transport in this starter. `createAppServer` is the seam for a later Streamable HTTP transport, but HTTP, OAuth, and npm publication are intentionally out of scope. Stdout is reserved for JSON-RPC; every log line goes to stderr through Pino.
