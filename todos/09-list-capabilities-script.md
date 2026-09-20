# 09 - List registered capabilities in the console

Status: [ ] Not started

Source: User-requested follow-up to the starter baseline in `PLAN.md`.

Depends on: [08 Capability scaffold generator](08-capability-generator.md).

## Outcome

A developer can run one Node script and inspect every registered tool, resource, and prompt in a readable console table without starting the MCP transport.

## Implementation

- [ ] Add an ESM Node script at `scripts/list-capabilities.mjs` and expose it through an npm script such as `npm run list:capabilities`.
- [ ] Load the built capability composition, call `getCapabilities()` directly, and do not create an `McpServer` or start stdio. Make the build prerequisite explicit in the npm command or in a clear stale-build error.
- [ ] Normalize tools, resources, and prompts into rows with stable columns for capability type, name, identifier, and description. Use the resource URI as its identifier and the capability name for tools and prompts.
- [ ] Render the rows with `console.table` and produce a clear message when no capabilities are registered.
- [ ] Keep executable handlers, schemas, and request data out of the output. This command is metadata inspection only.
- [ ] Send loading and validation failures to stderr, include an actionable recovery command, and exit nonzero.
- [ ] Add focused tests for mixed capability kinds, empty collections, ordering, and module-load failure.
- [ ] Document the build and listing commands in the root README.

## Acceptance criteria

- [ ] The command prints every capability returned by `getCapabilities()` in a console table.
- [ ] The starter output includes tool `add`, resource `project://info`, and prompt `code_review` with the correct type and description metadata.
- [ ] Rows have deterministic type and name ordering so output is easy to scan and test.
- [ ] Running the command never starts a server, writes MCP protocol data, or invokes a capability handler.
- [ ] Missing or stale build output fails clearly instead of printing an incomplete table.

## Verification

- [ ] Build the project, run the listing command, and inspect the table for all three sample capabilities.
- [ ] Register a generated capability from task 08, rebuild, and verify that it appears exactly once.
- [ ] Run the focused tests for mixed, empty, and failed-load cases.
- [ ] Run lint, tests, and build after adding the script and documentation.

## Deliberately deferred

JSON or Markdown output, filtering, watch mode, remote server discovery, invoking capabilities, and static scanning of unregistered source folders remain out of scope.
