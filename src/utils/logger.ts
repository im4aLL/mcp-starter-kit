import pino from "pino";

// Shared application logger.
//
// MCP stdio reserves stdout for JSON-RPC, so every log record is written to
// file descriptor 2 (stderr) as newline-delimited JSON. The `LOG_LEVEL`
// environment variable overrides the default `info` level.
export const logger = pino(
  {
    name: "mcp-framework",
    level: process.env.LOG_LEVEL ?? "info",
  },
  pino.destination(2),
);
