---
outline: deep
---

# Resources

A resource is URI-addressable content that a client can read. Use resources for read-only information the model or user needs, such as project metadata, status snapshots, configuration summaries, or reference text.

## How a resource works

Each resource is one class with a `@resource` decorator that declares its URI, display name, description, and an optional MIME hint for listings. The handler receives the requested URI string and returns the content.

Unlike tools, resources do not have a Zod input schema. The URI is the address. The returned value can be plain text or structured data, and the server derives the actual content MIME from the handler value.

The `@resource` decorator already applies dependency-injection metadata, so do not add a separate injectable decorator to a resource class.

## Create a resource

Generate the scaffold first. This example uses a `status` resource.

```sh
npm run generate resource status
```

Pick a stable URI for the decorator. The template starts with a placeholder such as `status://info`; replace it with the address your clients will request.

```ts
import { resource } from "../../core/decorators";
import type { IMcpResourceHandler } from "../../core/types";
import type { StatusResourceType } from "./status-resource.types";

@resource({
  uri: "status://current",
  name: "Current status",
  description: "Returns the current system status.",
  mimeType: "text/plain",
})
export class StatusResource implements IMcpResourceHandler {
  public handler(_uri: string): StatusResourceType {
    return "All systems operational.";
  }
}
```

Define the result type in the generated types file. The sample project uses a plain-text string schema for its project-info resource; use a string type for text and an object type for structured content.

Register the constructor in the capability registry function `getCapabilityTypes()` under the resources list. A resource URI must be unique across your server, and the listing command fails with recovery guidance if two resources claim the same URI.

## Learn from the sample

Your scaffolded project ships with a project-info resource at a `project://info` style URI that returns a short plain-text description. It shows the minimal shape: decorator with URI and MIME hint, a handler that ignores the URI parameter and returns text, and a string schema for the domain result.

## Test a resource

Generated resource specs check the schema and call the handler directly with a URI. Follow that shape: assert the schema accepts your content and the handler returns what clients should see.

```ts
import { describe, expect, it } from "vitest";

describe("StatusResource handler", () => {
  it("returns current status text", () => {
    const resource = new StatusResource();

    expect(resource.handler("status://current")).toBe("All systems operational.");
  });
});
```

Verify registration without starting the server.

```sh
npm run list:capabilities
```

The listing shows resources with their URI as the identifier, ordered with tools first, then resources, then prompts.

## Resource checklist

Choose a URI you can keep stable because clients store it. Write a display name and description that help users pick the right resource from a list. Return plain text for human reading and objects for machine consumption. Keep the URI unique. Register the constructor, otherwise the resource stays invisible.
