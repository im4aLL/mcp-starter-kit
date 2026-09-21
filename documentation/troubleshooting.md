---
outline: deep
---

# Troubleshooting

This page collects the most common failures, what causes them, and how to fix them.

## Generator refuses a name

`Unsupported kind` means the first argument is not one of `tool`, `resource`, `prompt`, or `service`. Check the spelling and order: kind first, then name.

`Missing name` means you passed only a kind. Add a kebab-case base name such as `multiply`.

`Invalid name` means a path segment breaks kebab-case rules. Use lowercase letters, digits, and single hyphens per segment, with no empty segments. Good values are `multiply`, `order-status`, and `billing/multiply`.

`Unsafe name` means the path contains backslashes, empty segments, or parent segments. Use forward slashes only and keep every segment a valid kebab-case name.

`Name already ends with -kind` means you included the suffix yourself, for example `multiply-tool`. Pass the base name `multiply` and let the generator append the suffix.

`Unknown option` means you passed an unsupported flag. The only supported flag is `--dry-run`.

## Generator refuses to write

`Refusing to overwrite existing files` means at least one planned file already exists. The generator writes nothing in this case. Rename your base name, remove the stale scaffold, or implement the existing files instead of regenerating.

`Refusing to write outside the project directory` means the resolved output escapes the project root. Stay with normal kebab-case paths and do not use absolute paths or parent segments.

`Missing template file` means a scaffold template was deleted or renamed. Restore the templates folder before generating again.

If you use npm, note that a bare `--dry-run` can be consumed by npm itself instead of forwarded to the script. The generator also respects the npm dry-run config, so `npm run generate tool multiply --dry-run` still previews correctly.

## Listing fails or looks wrong

`Failed to load the capability sources` means a capability module threw during import. The most common cause is one class carrying multiple capability decorators. Keep exactly one of `@tool`, `@resource`, or `@prompt` per class, fix the module, and retry.

`Capability metadata listing failed` means a listed constructor has invalid metadata. Check for a wrong decorator kind, missing decorator, duplicate tool or prompt names, duplicate resource URIs, and stale imports in the registry function `getCapabilityTypes()`.

`No capability constructors are registered` is informational, not a crash. Add at least one constructor to the registry and retry.

A capability that exists in code but is missing from the table is almost always unregistered. The generator never registers for you, so confirm the constructor appears in the registry return value.

## Server does not start or clients see stale code

Rebuild before connecting because clients launch the built bundle, not your TypeScript sources. Run `npm run build` after every change you want the client to see, or use `npm run dev` for direct TypeScript execution during development.

If Cursor or another client shows old behavior, confirm its configured path points at your current project build output and not at a copied starter folder. Rename the client entry when you rename your project so entries do not collide.

If logs are missing, remember they go to stderr as JSON, not stdout. Set `LOG_LEVEL=debug` for more detail. Never write to stdout from handlers or services because stdout carries protocol traffic.

## Tests or types fail after a change

Run the focused checks in order: listing first for registration mistakes, typecheck for contract mismatches, then the test suite for behavior.

```sh
npm run list:capabilities
npm run typecheck
npm test
```

Schema errors usually mean the Zod contract and the handler disagree. Derive handler types from the schemas instead of hand-writing them so the compiler catches drift.

Injection errors usually mean a new service is missing from the provider configuration or a custom-bound service was also left in the services list. Ordinary services belong in the list; custom-bound services belong only in the configure step. See [Services and Injection](/services) for the exact split.

Still stuck? Reproduce with the smallest scaffold that fails, run the generator with `--dry-run` to confirm the planned files, and compare your decorator metadata against the samples and the [Tools](/tools), [Resources](/resources), and [Prompts](/prompts) guides.
