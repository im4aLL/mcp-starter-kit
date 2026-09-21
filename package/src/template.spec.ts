import { afterEach, describe, expect, it, vi } from "vitest";

import { ScaffoldError } from "./errors";
import { cloneTemplate, resolveTemplateTag } from "./template";

interface IExecFileResult {
  stdout: string;
  stderr: string;
}

const { execFileMock } = vi.hoisted(() => ({
  execFileMock:
    vi.fn<
      (
        file: string,
        args: string[],
        options: Record<string, unknown>,
        callback: (error: Error | null, result?: IExecFileResult) => void,
      ) => void
    >(),
}));

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

/**
 * Makes the mocked git invocation resolve with the given standard output.
 *
 * @param stdout - Standard output returned by the mocked command.
 */
function respondWith(stdout: string): void {
  execFileMock.mockImplementation((_file, _args, _options, callback) => {
    callback(null, { stdout, stderr: "" });
  });
}

/**
 * Makes the mocked git invocation reject with the given error.
 *
 * @param error - Error returned by the mocked command.
 */
function respondWithError(error: Error): void {
  execFileMock.mockImplementation((_file, _args, _options, callback) => {
    callback(error);
  });
}

/**
 * Builds an error carrying the given Node-style properties.
 *
 * @param properties - Properties merged onto the error.
 * @returns The constructed error.
 */
function errorWith(properties: Record<string, unknown>): Error {
  return Object.assign(new Error("git failed"), properties);
}

afterEach(() => {
  execFileMock.mockReset();
});

describe("resolveTemplateTag", () => {
  it("returns the resolved tag when ls-remote reports it", async () => {
    respondWith("abc123\trefs/tags/v0.1.0\n");

    await expect(resolveTemplateTag("repository", undefined, "0.1.0")).resolves.toBe("v0.1.0");
  });

  it("passes a timeout to ls-remote", async () => {
    respondWith("abc123\trefs/tags/v0.1.0\n");

    await resolveTemplateTag("repository", undefined, "0.1.0");

    const [, args, options] = execFileMock.mock.calls[0];
    expect(args).toContain("ls-remote");
    expect(options.timeout).toBe(30000);
  });

  it("fails when the resolved tag is missing", async () => {
    respondWith("");

    await expect(resolveTemplateTag("repository", undefined, "0.1.0")).rejects.toBeInstanceOf(ScaffoldError);
  });

  it("fails when an explicit tag is missing", async () => {
    respondWith("");

    await expect(resolveTemplateTag("repository", "v9.9.9", "0.1.0")).rejects.toThrow(
      'Template tag "v9.9.9" was not found in repository.',
    );
  });

  it("maps a missing git executable to a friendly message", async () => {
    respondWithError(errorWith({ code: "ENOENT" }));

    await expect(resolveTemplateTag("repository", undefined, "0.1.0")).rejects.toThrow("git executable was not found");
  });

  it("maps a timeout to a friendly message", async () => {
    respondWithError(errorWith({ killed: true }));

    await expect(resolveTemplateTag("repository", undefined, "0.1.0")).rejects.toThrow("timed out");
  });

  it("does not map a non-timeout signal to the timeout message", async () => {
    respondWithError(errorWith({ signal: "SIGINT" }));

    await expect(resolveTemplateTag("repository", undefined, "0.1.0")).rejects.not.toThrow("timed out");
  });
});

describe("cloneTemplate", () => {
  it("shallow-clones the tag into the target directory with a timeout", async () => {
    respondWith("");

    await cloneTemplate("repository", "v1.2.3", "/tmp/target");

    const [, args, options] = execFileMock.mock.calls[0];
    expect(args).toEqual(["clone", "--depth=1", "--single-branch", "--branch", "v1.2.3", "repository", "/tmp/target"]);
    expect(options.timeout).toBe(60000);
  });

  it("maps a clone timeout to a friendly message", async () => {
    respondWithError(errorWith({ code: "ETIMEDOUT" }));

    await expect(cloneTemplate("repository", "v1.2.3", "/tmp/target")).rejects.toThrow("timed out");
  });
});
