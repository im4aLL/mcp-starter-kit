#!/usr/bin/env node
import "reflect-metadata";

import type { McpServer } from "@modelcontextprotocol/server";

import { createServer } from "./core/create-server.ts";
import { startStdio } from "./core/transports/stdio.ts";

/**
 * Creates a fresh MCP server for a single stdio connection.
 *
 * The SDK may call this factory more than once per process, so no server state
 * is shared between invocations. Application composition (containers,
 * capabilities, providers) is added here in later tasks.
 *
 * @returns A new empty MCP server.
 */
function createAppServer(): McpServer {
  return createServer();
}

startStdio(createAppServer);
