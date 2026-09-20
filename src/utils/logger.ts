import pino from "pino";

import { serverConfig } from "../config";

// Shared application logger.
//
// The logger name follows the application-owned server identity in
// `src/config.ts`. MCP stdio reserves stdout for JSON-RPC, so every log record
// is written to file descriptor 2 (stderr) as newline-delimited JSON. The
// `LOG_LEVEL` environment variable overrides the default `info` level.
export const logger = pino(
  {
    name: serverConfig.name,
    level: process.env.LOG_LEVEL ?? "info",
  },
  pino.destination(2),
);
