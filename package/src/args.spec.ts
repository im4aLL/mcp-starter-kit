import { describe, expect, it } from "vitest";

import { parseArgs } from "./args";
import { ScaffoldError } from "./errors";

describe("parseArgs", () => {
  it("parses a project name", () => {
    expect(parseArgs(["my-server"])).toEqual({ name: "my-server", help: false, version: false });
  });

  it("parses a name and an explicit tag", () => {
    expect(parseArgs(["my-server", "--tag", "v2.0.0"])).toEqual({
      name: "my-server",
      tag: "v2.0.0",
      help: false,
      version: false,
    });
  });

  it("parses the --tag=<value> form", () => {
    expect(parseArgs(["my-server", "--tag=v2.0.0"])).toEqual({
      name: "my-server",
      tag: "v2.0.0",
      help: false,
      version: false,
    });
  });

  it("trims padded tag values", () => {
    expect(parseArgs(["my-server", "--tag", "  v1.2.3  "])).toEqual({
      name: "my-server",
      tag: "v1.2.3",
      help: false,
      version: false,
    });
    expect(parseArgs(["my-server", "--tag=  v1.2.3"])).toEqual({
      name: "my-server",
      tag: "v1.2.3",
      help: false,
      version: false,
    });
  });

  it("parses help and version flags", () => {
    expect(parseArgs(["--help"])).toMatchObject({ help: true });
    expect(parseArgs(["-h"])).toMatchObject({ help: true });
    expect(parseArgs(["--version"])).toMatchObject({ version: true });
    expect(parseArgs(["-v"])).toMatchObject({ version: true });
  });

  it("rejects unknown options", () => {
    expect(() => parseArgs(["--nope"])).toThrow(ScaffoldError);
  });

  it("rejects a tag without a value", () => {
    expect(() => parseArgs(["my-server", "--tag"])).toThrow(ScaffoldError);
  });

  it("rejects an empty or whitespace-only tag value", () => {
    expect(() => parseArgs(["my-server", "--tag="])).toThrow("Option --tag requires a value.");
    expect(() => parseArgs(["my-server", "--tag", "   "])).toThrow("Option --tag requires a value.");
  });

  it("rejects more than one positional", () => {
    expect(() => parseArgs(["one", "two"])).toThrow(ScaffoldError);
  });
});
