# 02 - Project info resource

Status: [x] Done

Source: `PLAN.md` sections "Core contract", "Resource serialization", "Schema ownership", "Decorated capability constructors and resolved collections", and "Samples (easy to delete when copying)".

Depends on: [01 Add tool vertical slice](01-add-tool.md).

## Outcome

A client can list and read `project://info`. The listing advertises `text/plain`, and reading returns the static project description unchanged as plain text. The resource uses constructor metadata and the same container-managed capability path established by the tool.

## Target shape

```ts
/**
 * Provides static information about the starter project.
 */
@resource({
  uri: "project://info",
  name: "Project information",
  description: "Describes the MCP starter project.",
  mimeType: "text/plain",
})
export class ProjectInfoResource implements IMcpResourceHandler {
  /**
   * Returns project information.
   *
   * @param _uri - URI requested by the MCP client.
   * @returns The plain-text project description.
   */
  public handler(_uri: string): ProjectInfo {
    return "A class-based MCP server starter.";
  }
}
```

Registration remains explicit:

```ts
/**
 * Returns the capability constructors registered by the application.
 *
 * @returns Explicit tool, prompt, and resource constructor lists.
 */
export function getCapabilityTypes(): ICapabilities {
  return {
    tools: [AddTool],
    prompts: [],
    resources: [ProjectInfoResource],
  };
}
```

## Implementation

- [x] Add `JsonPrimitive`, `JsonObject`, `JsonArray`, and `JsonValue` plus non-generic resource handler, resource metadata, constructor-list, and resolved-resource contracts to `src/core/types.ts`. Keep domain resource returns limited to strings or valid JSON values and permit SDK wire contents.
- [x] Add `src/resources/project-info/project-info.schemas.ts` with a Zod string schema that documents the sample's domain result and `project-info.types.ts` with its inferred `ProjectInfo` type. Do not pass this schema to the SDK or parse resource bodies in core because MCP resources have no domain-output schema application step.
- [x] Add a typed `@resource` decorator and direct metadata reader to `src/core/decorators.ts`. Have `@resource` apply Inversify's `injectable()` metadata internally. MCP metadata belongs to the constructor and must not become instance fields or trigger binding, discovery, or automatic registration.
- [x] Add `ProjectInfoResource` in the target shape above with only `@resource(...)`, `implements IMcpResourceHandler`, and an explicitly annotated `handler(_uri: string): ProjectInfo`. Do not repeat `@injectable()` on the capability class.
- [x] Extend `getCapabilityTypes()` with `ProjectInfoResource`, bind the listed resource constructor in the per-server container, resolve it through the common resolver, and extend capability registration to call the resolved instance's `handler(uri, extra)` without parsing.
- [x] Add `isJsonValue`, `ResourceSerializationError`, and complete resource domain mapping to `map-results.ts`: check wire `{ contents }` first, then strings, then other JSON values.
- [x] Map strings to `text/plain` without JSON quoting and map other JSON values to `application/json` with `JSON.stringify`.
- [x] Reject unsupported values, nonfinite numbers, nonplain objects, circular structures, and serialization failures. Log `resource serialization failed` with `{ err }` and rethrow so the SDK returns a protocol failure rather than fake contents.
- [x] Add handler, decorator metadata, container resolution, registration, and mapper specs for string, object, array, finite number, boolean, `null`, `undefined`, circular object, `Date`, and `NaN` behavior.
- [x] Add TSDoc above every introduced function, class, and class method.

## Acceptance criteria

- [x] MCP discovery lists `project://info` and its decorator-owned `text/plain` hint.
- [x] Reading the resource returns exactly one text content entry with URI `project://info`, MIME `text/plain`, and the unquoted static description.
- [x] Domain JSON values serialize with `application/json` independently of the decorator metadata listing MIME hint.
- [x] Unsupported or circular resource values throw `ResourceSerializationError`, are logged safely, and never become empty resource text.
- [x] Prebuilt SDK `{ contents }` results are returned unchanged before JSON-value detection.
- [x] `ProjectInfoResource` is explicitly listed as a constructor and resolved from the same per-server container as `AddTool`.

## Verification

- [x] Run lint, tests, and build.
- [x] Use Inspector or a real SDK client to list and read `project://info` and inspect the returned URI, MIME, and text.
- [x] Run focused mapper tests for every required supported and rejected value.
- [x] Confirm a seeded invalid resource fails at the protocol boundary and logs only to stderr.
- [x] Confirm metadata listing does not instantiate `ProjectInfoResource` and runtime resolution does.

## Deliberately deferred

Prompt support, mixed tool and prompt wire-result coverage, complete decorator type proof and duplicate-identifier validation, lifecycle signal handling, binary domain wrapping, resource templates, subscriptions, and dynamic resource enumeration.
