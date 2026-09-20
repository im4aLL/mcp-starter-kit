# 08 - Capability scaffold generator

Status: [ ] Not started

Source: User-requested follow-up to the starter baseline in `PLAN.md`.

Depends on: [07 Verification, packaging, and starter documentation](07-verification-packaging-and-docs.md).

## Outcome

A developer can run `npm run generate <tool|resource|prompt> <name>` to generate a convention-compliant starter scaffold without copying and renaming the sample files by hand. For example, `npm run generate tool add` creates:

```text
src/tools/add-tool/
  add-tool.ts
  add-tool.schemas.ts
  add-tool.types.ts
  add-tool.spec.ts
```

## Implementation

- [ ] Add an ESM Node script at `scripts/generate.mjs` and expose it as the `generate` npm script so the public command is exactly `npm run generate <tool|resource|prompt> <name>`.
- [ ] Accept a singular capability kind and kebab-case base name, derive safe class and file names, and reject unsupported kinds, invalid names, path traversal, and missing arguments with actionable messages.
- [ ] For tools, append the kind suffix to the base name. `npm run generate tool add` must create `src/tools/add-tool/` containing `add-tool.ts`, `add-tool.schemas.ts`, `add-tool.types.ts`, and `add-tool.spec.ts`.
- [ ] Generate equivalent four-file scaffolds beneath `src/resources` and `src/prompts`, using one documented and tested naming rule for their folder and file base names.
- [ ] Make each template a minimal valid capability that follows the existing contracts, schema ownership, imports, TSDoc, and co-located test patterns.
- [ ] Refuse to overwrite any existing file. Validate the entire target set before writing so a failed generation does not leave a partial scaffold.
- [ ] Generate only the capability scaffold. Do not read or modify `src/capabilities/capabilities.ts`; the developer will import and register the generated capability manually.
- [ ] Keep the script dependency-free unless the implementation proves a parser or template dependency is necessary.
- [ ] Add focused tests that run generation in a temporary fixture for all three capability kinds and cover invalid input, collisions, and partial-write prevention.
- [ ] Document the generator command and note that registration in `src/capabilities/capabilities.ts` remains a manual step in the root README.

## Acceptance criteria

- [ ] `npm run generate tool add` creates exactly the `src/tools/add-tool/` structure documented above.
- [ ] The same command shape can generate a resource or prompt scaffold in the expected source directory.
- [ ] Generated files follow repository naming, schema, test, formatting, and TSDoc conventions.
- [ ] Existing files are never modified or overwritten by generation.
- [ ] Invalid kinds and unsafe or malformed names fail with a nonzero exit code and a useful stderr message.
- [ ] The script changes only the new capability directory. It does not update registration, add a second capability registry, or introduce hidden discovery.

## Verification

- [ ] Run `npm run generate tool add` in a temporary repository copy and verify the exact `src/tools/add-tool/` folder and four-file layout.
- [ ] Generate one resource and one prompt with the same command shape and inspect their resulting paths and contents.
- [ ] Register the generated capabilities, then run lint, tests, and build.
- [ ] Repeat a generation command for an existing target and verify that it fails without changing any file.
- [ ] Run the invalid-name and simulated target-collision tests and confirm no partial directories or files remain.

## Deliberately deferred

Interactive prompts, custom template packs, automatic business-logic generation, automatic registration, a standalone generator package, and project-wide renaming remain out of scope.
