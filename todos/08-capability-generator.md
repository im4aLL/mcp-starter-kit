# 08 - Capability scaffold generator

Status: [ ] Not started

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
export class MultiplyTool implements McpToolHandler {
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

## Implementation

- [ ] Add an ESM Node script at `scripts/generate.mjs` and expose it as the `generate` npm script so the public command is exactly `npm run generate <tool|resource|prompt> <name>`.
- [ ] Accept a singular capability kind and kebab-case base name, derive safe class and file names, and reject unsupported kinds, invalid names, path traversal, and missing arguments with actionable messages.
- [ ] For tools, append the kind suffix to the base name. `npm run generate tool multiply` must create `src/tools/multiply-tool/` containing `multiply-tool.ts`, `multiply-tool.schemas.ts`, `multiply-tool.types.ts`, and `multiply-tool.spec.ts`.
- [ ] Generate equivalent four-file scaffolds beneath `src/resources` and `src/prompts`, using one documented and tested naming rule for their folder and file base names.
- [ ] Make each template a minimal valid capability whose `@tool`, `@resource`, or `@prompt` decorator supplies both MCP metadata and Inversify injectable metadata. Follow the non-generic handler contracts, schema-derived method annotations, imports, TSDoc, and co-located test patterns without emitting a separate `@injectable()` decorator. Tool and prompt templates must let their typed decorators verify the schema-specific handler contract.
- [ ] Refuse to overwrite any existing file. Validate the entire target set before writing so a failed generation does not leave a partial scaffold.
- [ ] Generate only the capability scaffold. Do not read or modify `src/capabilities/capabilities.ts`, `src/providers.ts`, or container bindings; the developer will import the generated class, add its constructor to `getCapabilityTypes()`, and add any required service providers manually.
- [ ] Keep the script dependency-free unless the implementation proves a parser or template dependency is necessary.
- [ ] Add focused tests that run generation in a temporary fixture for all three capability kinds and cover invalid input, collisions, and partial-write prevention.
- [ ] Document the generator command and note that explicit constructor registration in `getCapabilityTypes()` plus any required service registration in `src/providers.ts` remains a manual step in the root README.

## Acceptance criteria

- [ ] `npm run generate tool multiply` creates exactly the `src/tools/multiply-tool/` structure documented above without colliding with the runtime `add` sample.
- [ ] The same command shape can generate a resource or prompt scaffold in the expected source directory.
- [ ] Generated files follow repository naming, single capability-decorator injection setup, schema-derived method typing, test, formatting, and TSDoc conventions.
- [ ] Existing files are never modified or overwritten by generation.
- [ ] Invalid kinds and unsafe or malformed names fail with a nonzero exit code and a useful stderr message.
- [ ] The script changes only the new capability directory. It does not update constructor registration, provider configuration, or container bindings, add a second capability registry, introduce hidden discovery, or instantiate the generated class.

## Verification

- [ ] Run `npm run generate tool multiply` in a temporary repository copy and verify the exact `src/tools/multiply-tool/` folder and four-file layout.
- [ ] Generate one resource and one prompt with the same command shape and inspect their resulting paths and contents.
- [ ] Add the generated class constructors to `getCapabilityTypes()`, add any needed services to `src/providers.ts`, then run lint, tests, and build.
- [ ] Repeat a generation command for an existing target and verify that it fails without changing any file.
- [ ] Run the invalid-name and simulated target-collision tests and confirm no partial directories or files remain.

## Deliberately deferred

Interactive prompts, custom template packs, automatic business-logic generation, automatic registration, a standalone generator package, and project-wide renaming remain out of scope.
