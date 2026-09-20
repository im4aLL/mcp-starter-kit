# 02 - Project info resource

Status: [ ] Not started

Source: `PLAN.md` sections "Core contract", "Resource serialization", "Schema ownership", and "Samples (easy to delete when copying)".

Depends on: [01 Add tool vertical slice](01-add-tool.md).

## Outcome

A client can list and read `project://info`. The listing advertises `text/plain`, and reading returns the static project description unchanged as plain text.

## Implementation

- [ ] Add `JsonPrimitive`, `JsonObject`, `JsonArray`, and `JsonValue` plus specific and erased resource contracts to `src/core/types.ts`. Keep domain resource returns limited to strings or valid JSON values and permit SDK wire contents.
- [ ] Add `src/resources/project-info/project-info.schemas.ts` with a Zod string schema that documents the sample's domain result and `project-info.types.ts` with its inferred type. Do not pass this schema to the SDK or parse resource bodies in core because MCP resources have no domain-output schema application step.
- [ ] Add `project-info.ts` with a pure `ProjectInfoResource` class whose URI is `project://info`, listing MIME is `text/plain`, and handler returns a static string.
- [ ] Extend `getCapabilities()` with a fresh resource instance and extend capability registration to call `handler(uri, extra)` without parsing.
- [ ] Add `isJsonValue`, `ResourceSerializationError`, and complete resource domain mapping to `map-results.ts`: check wire `{ contents }` first, then strings, then other JSON values.
- [ ] Map strings to `text/plain` without JSON quoting and map other JSON values to `application/json` with `JSON.stringify`.
- [ ] Reject unsupported values, nonfinite numbers, nonplain objects, circular structures, and serialization failures. Log `resource serialization failed` with `{ err }` and rethrow so the SDK returns a protocol failure rather than fake contents.
- [ ] Add handler, registration, and mapper specs for string, object, array, finite number, boolean, `null`, `undefined`, circular object, `Date`, and `NaN` behavior.
- [ ] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [ ] MCP discovery lists `project://info` and its `text/plain` hint.
- [ ] Reading the resource returns exactly one text content entry with URI `project://info`, MIME `text/plain`, and the unquoted static description.
- [ ] Domain JSON values serialize with `application/json` independently of the class-level listing MIME hint.
- [ ] Unsupported or circular resource values throw `ResourceSerializationError`, are logged safely, and never become empty resource text.
- [ ] Prebuilt SDK `{ contents }` results are returned unchanged before JSON-value detection.

## Verification

- [ ] Run lint, tests, and build.
- [ ] Use Inspector or a real SDK client to list and read `project://info` and inspect the returned URI, MIME, and text.
- [ ] Run focused mapper tests for every required supported and rejected value.
- [ ] Confirm a seeded invalid resource fails at the protocol boundary and logs only to stderr.

## Deliberately deferred

Prompt support, mixed tool and prompt wire-result coverage, heterogeneous type proof, lifecycle signal handling, binary domain wrapping, resource templates, subscriptions, and dynamic resource enumeration.
