# 04 - Result mapping and serialization

Status: [x] Done

Source: `PLAN.md` sections "Handler results: domain default, wire pass-through", "Resource serialization", and "Logger (pino)".

Depends on: [03 Code review prompt](03-code-review-prompt.md).

## Outcome

Capability authors can use the simple domain-return path or return supported SDK wire results for mixed content without changing core. Clients observe valid results in either form, and invalid resource domain values fail predictably.

## Implementation

- [x] Finalize `ToolHandlerResultType`, `ResourceHandlerResultType`, and `PromptHandlerResultType` unions using the verified SDK v2 result and content types.
- [x] Add narrow structural guards for `CallToolResult`, resource `{ contents }`, and prompt `{ messages }`. Keep the documented limitation that a structured tool output containing a content-block array is interpreted as wire format.
- [x] Make `mapToolResult` return SDK wire results unchanged and otherwise return one JSON text content block plus the original structured output.
- [x] Make `mapResourceResult` return SDK contents unchanged before applying the string and JSON-value domain serialization paths.
- [x] Make prompt mapping return SDK messages unchanged and otherwise wrap a string into one text message using the default role from resolved decorator metadata.
- [x] Preserve extra wire fields by returning the original object, not a reconstructed subset.
- [x] Keep thrown tool handling separate from wire pass-through: map thrown values to `isError: true` text content and log through Pino without leaking stack details to clients.
- [x] Complete behavior-focused mapper specs for domain and wire paths, identity preservation, tool failure, prompt default and assistant roles, mixed prompt messages, mixed tool content, binary resource contents, all resource JSON primitives/containers, and all documented serialization failures.
- [x] Add TSDoc above every introduced or changed function, class, and class method.

## Acceptance criteria

- [x] Domain tool content and `structuredContent` represent the same output.
- [x] Valid prebuilt tool, resource, and prompt wire results are returned by identity and keep mixed content, roles, MIME ownership, and additional fields.
- [x] Strings are not JSON quoted as resources or prompts.
- [x] Unsupported resource domain values consistently throw `ResourceSerializationError` and no registration layer converts them to fake contents.
- [x] No generic prose formatter, branded result helper, or second mapping pipeline is introduced.

## Verification

- [x] Run focused mapper specs, then the full lint, test, and build commands.
- [x] Add decorated test-only capability fixtures, resolve them through a test container, and invoke each domain and wire path through the actual registration callbacks or a real SDK client.
- [x] Verify object identity for pass-through results and exact text/MIME values for mapped domain results.
- [x] Verify error logs use `{ err }` on stderr while client-visible tool error text remains safe.

## Deliberately deferred

New runtime sample capabilities, branded disambiguation helpers, domain binary support, richer human-readable tool formatting, HTTP transport, authentication, and arbitrary prompt-content builders.
