import { describe, expect, it } from "vitest";

import { ProjectInfoResource } from "./project-info";
import { ProjectInfoSchema } from "./project-info.schemas";

describe("ProjectInfo schemas", () => {
  it("accepts a plain-text project description", () => {
    expect(ProjectInfoSchema.safeParse("A class-based MCP server starter.").success).toBe(true);
  });

  it("rejects non-string values", () => {
    expect(ProjectInfoSchema.safeParse(1).success).toBe(false);
    expect(ProjectInfoSchema.safeParse({ text: "no" }).success).toBe(false);
  });
});

describe("ProjectInfoResource handler", () => {
  it("returns the static description unchanged", () => {
    const resource = new ProjectInfoResource();

    expect(resource.handler("project://info")).toBe("A class-based MCP server starter.");
  });
});
