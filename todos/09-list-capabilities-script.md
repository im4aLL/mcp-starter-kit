# 09 - List registered capabilities in the console

Status: [ ] Not started

Source: User-requested follow-up to the starter baseline in `PLAN.md`.

Depends on: [08 Capability scaffold generator](08-capability-generator.md).

## Outcome

A developer can run one Node script and inspect every explicitly registered tool, resource, and prompt in a readable console table without creating an Inversify container, constructing a capability, resolving a dependency, or starting the MCP transport.

## Target shape

The script reads the same constructor list used by the application and obtains metadata directly from the decorators:

```ts
const capabilityTypes = getCapabilityTypes();
const rows = listCapabilityMetadata(capabilityTypes);

console.table(rows);
```

It must not use the runtime path:

```ts
// Do not do this in the listing script.
const container = createAppContainer(capabilityTypes, providers);
const capabilities = resolveCapabilities(container, capabilityTypes);
```

## Implementation

- [ ] Add an ESM Node script at `scripts/list-capabilities.mjs` and expose it through an npm script such as `npm run list:capabilities`.
- [ ] Load the built capability composition, call `getCapabilityTypes()` directly, and do not create a container, resolve a constructor, create an `McpServer`, or start stdio. Make the build prerequisite explicit in the npm command or in a clear stale-build error.
- [ ] Read `@tool`, `@resource`, and `@prompt` metadata from each explicitly listed constructor through the same direct metadata-reader API used by runtime resolution.
- [ ] Normalize metadata into rows with stable columns for capability type, name, identifier, and description. Use the resource URI as its identifier and the capability name for tools and prompts.
- [ ] Render the rows with `console.table` and produce a clear message when no capability constructors are registered.
- [ ] Do not load `src/providers.ts`. Keep constructors, executable handlers, schemas, provider configuration, service bindings, container state, and request data out of the output. This command is metadata inspection only.
- [ ] Reuse constructor-list validation for missing capability metadata, wrong capability kinds, and duplicate identifiers without resolving the classes. Treat contextual class-evaluation failures from multiple capability decorators as module-load failures. Send failures to stderr, include an actionable recovery command, and exit nonzero.
- [ ] Add focused tests for mixed capability kinds, empty constructor lists, deterministic ordering, metadata-validation failure, module-load failure, and proof that constructors are never invoked.
- [ ] Document the build and listing commands in the root README.
- [ ] Repeat final clean-install, packed-file, package-bin, and compiled-output verification after tasks 08 and 09 have changed scripts, package metadata, and documentation.

## Acceptance criteria

- [ ] The command prints every constructor returned by `getCapabilityTypes()` using its decorator metadata.
- [ ] The starter output includes tool `add`, resource `project://info`, and prompt `code_review` with the correct type and description metadata.
- [ ] Rows have deterministic type and name ordering so output is easy to scan and test.
- [ ] Running the command never creates an Inversify container, resolves a service, invokes a capability constructor or handler, starts a server, or writes MCP protocol data.
- [ ] Missing capability metadata, multiple capability decorators, a wrong decorator kind, duplicate identifiers, and missing or stale build output fail clearly instead of printing an incomplete table.
- [ ] The final packed starter includes the intended developer scripts and still passes the clean-consumer checks established in task 07.

## Verification

- [ ] Build the project, run the listing command, and inspect the table for all three sample capabilities.
- [ ] Add a generated capability constructor to `getCapabilityTypes()`, rebuild, and verify that it appears exactly once without adding a container binding for the listing command.
- [ ] Run focused mixed, empty, invalid-metadata, failed-load, and constructor-noninvocation tests.
- [ ] From a clean temporary copy, run `npm ci`, lint, tests, build, `npm pack --dry-run`, package-bin execution, the generator smoke path, and capability listing after adding the script and documentation.

## Deliberately deferred

JSON or Markdown output, filtering, watch mode, remote server discovery, dependency resolution, invoking capabilities, and static scanning of unregistered source folders remain out of scope.
