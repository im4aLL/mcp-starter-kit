import { describe, expect, it } from "vitest";

import { ScaffoldError } from "./errors";
import { deriveBinName, validateProjectName } from "./name";

describe("validateProjectName", () => {
  it("accepts lowercase, dotted, hyphenated, and scoped names", () => {
    for (const name of ["server", "my-server", "a.b_c", "@scope/my-server"]) {
      expect(() => validateProjectName(name)).not.toThrow();
    }
  });

  it("rejects empty, spaced, and uppercase names", () => {
    for (const name of ["", "my server", "MyServer"]) {
      expect(() => validateProjectName(name)).toThrow(ScaffoldError);
    }
  });

  it("rejects path traversal and absolute paths", () => {
    for (const name of ["..", "../escape", "/absolute", "a/b/c", "a\\b"]) {
      expect(() => validateProjectName(name)).toThrow(ScaffoldError);
    }
  });
});

describe("deriveBinName", () => {
  it("returns the name unchanged when unscoped", () => {
    expect(deriveBinName("my-server")).toBe("my-server");
  });

  it("strips the scope when scoped", () => {
    expect(deriveBinName("@scope/my-server")).toBe("my-server");
  });
});
