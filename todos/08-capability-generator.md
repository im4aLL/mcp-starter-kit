# 08 - Scaffold generator (capabilities and services)

Status: [x] Done

Source: User-requested follow-up to the starter baseline in `PLAN.md`.

Depends on: [07 Verification, packaging, and starter documentation](07-verification-packaging-and-docs.md).

## Outcome

A developer can run `npm run generate <tool|resource|prompt> <name>` to generate a convention-compliant starter scaffold without copying and renaming the sample files by hand. For example, `npm run generate tool multiply` creates:

```text
src/tools/multiply-tool/
  multiply-tool.ts
  multiply-tool.schemas.ts
  multiply-tool.types.ts
  multiply-tool.spec.ts
```

A developer can run `npm run generate service <name>` to generate an ordinary injectable service scaffold without copy-editing. For example, `npm run generate service inventory` creates:

```text
src/services/inventory-service.ts
src/services/inventory-service.spec.ts
```

A generated tool class follows the established authoring shape and is ready for constructor injection without requiring dependencies by default:

```ts
/**
 * Handles multiply tool requests.
 */
@tool({
  name: "multiply",
  description: "Describe the multiply tool.",
  inputSchema: MultiplyToolInputSchema,
  outputSchema: MultiplyToolOutputSchema,
})
export class MultiplyTool implements IMcpToolHandler {
  /**
   * Handles a validated multiply request.
   *
   * @param input - Validated tool input.
   * @returns The tool result.
   */
  public handler(input: MultiplyToolInput): MultiplyToolOutput {
    return {
      result: input.a * input.b,
    };
  }
}
```

The actual generated placeholder schemas and result fields must be internally consistent and immediately pass type checking. The generator does not add the class to `getCapabilityTypes()`.

A generated service uses Inversify's `@injectable()` directly because it is an ordinary dependency, not a capability, and it ships a co-located `*.spec.ts` that constructs the service and asserts its placeholder behavior. The generator does not add the service to `src/providers.ts`.

## Implementation

- [x] Add an ESM Node script at `scripts/generate.mjs` and expose it as the `generate` npm script so the public commands are exactly `npm run generate <tool|resource|prompt> <name>` and `npm run generate service <name>`.
- [x] Accept a singular kind (`tool`, `resource`, `prompt`, or `service`) and kebab-case base name, derive safe class and file names, and reject unsupported kinds, invalid names, path traversal, and missing arguments with actionable messages.
- [x] For tools, append the kind suffix to the base name. `npm run generate tool multiply` must create `src/tools/multiply-tool/` containing `multiply-tool.ts`, `multiply-tool.schemas.ts`, `multiply-tool.types.ts`, and `multiply-tool.spec.ts`.
- [x] Generate equivalent four-file scaffolds beneath `src/resources` and `src/prompts`, using one documented and tested naming rule for their folder and file base names.
- [x] For services, append the `-service` suffix to the base name and generate `src/services/<name>-service.ts` plus `src/services/<name>-service.spec.ts`. Use Inversify's `@injectable()` directly with no capability decorator, a placeholder method, and a co-located test that constructs the service and asserts that behavior.
- [x] Make each capability template a minimal valid capability whose `@tool`, `@resource`, or `@prompt` decorator supplies both MCP metadata and Inversify injectable metadata. Follow the non-generic handler contracts, schema-derived method annotations, imports, TSDoc, and co-located test patterns without emitting a separate `@injectable()` decorator. Tool and prompt templates must let their typed decorators verify the schema-specific handler contract.
- [x] Refuse to overwrite any existing file. Validate the entire target set before writing so a failed generation does not leave a partial scaffold.
- [x] Generate only the requested scaffold. Do not read or modify `src/capabilities/capabilities.ts`, `src/providers.ts`, or container bindings; the developer will import a generated capability, add its constructor to `getCapabilityTypes()`, and add any required service providers manually, or list a generated service in `src/providers.ts`.
- [x] Keep the script dependency-free unless the implementation proves a parser or template dependency is necessary.
- [x] Read each kind's file contents from template files under `scripts/templates/` instead of inline string builders, so a convention change is a template edit rather than a generator change.
- [x] Accept a slash-separated kebab-case path (for example `nested/test`). Earlier segments become nested directories and the last segment is the base name; imports to `src/core` are depth-adjusted for nested capabilities.
- [x] Add focused tests that run generation in a temporary fixture for all three capability kinds and for services, and cover invalid input, collisions, partial-write prevention, and nested paths.
- [x] Document the generator command and note that explicit constructor registration in `getCapabilityTypes()` plus any required service registration in `src/providers.ts` remains a manual step in the root README.

## Acceptance criteria

- [x] `npm run generate tool multiply` creates exactly the `src/tools/multiply-tool/` structure documented above without colliding with the runtime `add` sample.
- [x] `npm run generate service inventory` creates exactly `src/services/inventory-service.ts` and `src/services/inventory-service.spec.ts` without colliding with the runtime `CalculatorService` sample.
- [x] The same command shape can generate a resource or prompt scaffold in the expected source directory.
- [x] Generated files follow repository naming, single capability-decorator or direct-`@injectable()` injection setup, schema-derived method typing, test, formatting, and TSDoc conventions.
- [x] Existing files are never modified or overwritten by generation.
- [x] Invalid kinds and unsafe or malformed names fail with a nonzero exit code and a useful stderr message.
- [x] The script changes only the new scaffold files. It does not update constructor registration, provider configuration, or container bindings, add a second capability registry, introduce hidden discovery, or instantiate the generated class.

## Verification

- [x] Run `npm run generate tool multiply` in a temporary repository copy and verify the exact `src/tools/multiply-tool/` folder and four-file layout.
- [x] Generate one resource and one prompt with the same command shape and inspect their resulting paths and contents.
- [x] Run `npm run generate service inventory` and verify the exact `src/services/inventory-service.ts` and `src/services/inventory-service.spec.ts` layout and contents.
- [x] Add the generated capability constructors to `getCapabilityTypes()`, add the generated service (or any needed services) to `src/providers.ts`, then run lint, tests, and build.
- [x] Repeat a generation command for an existing target and verify that it fails without changing any file.
- [x] Run the invalid-name and simulated target-collision tests and confirm no partial directories or files remain.

## Deliberately deferred

Interactive prompts, custom template packs, automatic business-logic generation, automatic registration, a standalone generator package, and project-wide renaming remain out of scope.
