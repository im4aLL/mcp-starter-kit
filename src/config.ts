import type { IServerConfig } from "./core/types";

// Application-owned server identity advertised to MCP clients during
// initialization. Rename the defaults when copying the starter, or override
// them per launch with MCP_SERVER_NAME and MCP_SERVER_VERSION.
export const serverConfig: IServerConfig = {
  name: process.env.MCP_SERVER_NAME ?? "mcp-framework",
  version: process.env.MCP_SERVER_VERSION ?? "0.1.0",
};
