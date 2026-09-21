import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Environment variables read by the application-owned server configuration.
const SERVER_NAME_VARIABLE = "MCP_SERVER_NAME";
const SERVER_VERSION_VARIABLE = "MCP_SERVER_VERSION";

const originalServerName = process.env[SERVER_NAME_VARIABLE];
const originalServerVersion = process.env[SERVER_VERSION_VARIABLE];

/**
 * Sets or deletes one environment variable for a spec.
 *
 * @param name - Environment variable name.
 * @param value - Value to set, or `undefined` to delete the variable.
 */
function setEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];

    return;
  }

  process.env[name] = value;
}

/**
 * Restores one environment variable to its value before the spec ran.
 *
 * @param name - Environment variable name.
 * @param value - Original value, or `undefined` when the variable was absent.
 */
function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  setEnvironmentVariable(name, value);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  restoreEnvironmentVariable(SERVER_NAME_VARIABLE, originalServerName);
  restoreEnvironmentVariable(SERVER_VERSION_VARIABLE, originalServerVersion);
  vi.resetModules();
});

describe("serverConfig", () => {
  it("uses the application defaults when no environment override is set", async () => {
    setEnvironmentVariable(SERVER_NAME_VARIABLE, undefined);
    setEnvironmentVariable(SERVER_VERSION_VARIABLE, undefined);

    const { serverConfig } = await import("./config");

    expect(serverConfig).toEqual({ name: "mcp-starter-kit", version: "0.1.0" });
  });

  it("applies the name and version environment overrides", async () => {
    setEnvironmentVariable(SERVER_NAME_VARIABLE, "custom-server");
    setEnvironmentVariable(SERVER_VERSION_VARIABLE, "2.3.4");

    const { serverConfig } = await import("./config");

    expect(serverConfig).toEqual({ name: "custom-server", version: "2.3.4" });
  });

  it("allows overriding only one value while keeping the other default", async () => {
    setEnvironmentVariable(SERVER_NAME_VARIABLE, "renamed-server");
    setEnvironmentVariable(SERVER_VERSION_VARIABLE, undefined);

    const { serverConfig } = await import("./config");

    expect(serverConfig).toEqual({ name: "renamed-server", version: "0.1.0" });
  });
});
