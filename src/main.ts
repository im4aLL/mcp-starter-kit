#!/usr/bin/env node
import "reflect-metadata";

import type { McpServer } from "@modelcontextprotocol/server";

import { getCapabilityTypes } from "./capabilities/capabilities";
import { serverConfig } from "./config";
import { createAppContainer } from "./core/container";
import { createServer } from "./core/create-server";
import { resolveCapabilities } from "./core/resolve-capabilities";
import { startStdio } from "./core/transports/stdio";
import { providers } from "./providers";

/**
 * Creates a fresh MCP server for a single stdio connection.
 *
 * The SDK may call this factory more than once per process. Container creation
 * and capability resolution run inside the factory, so every server gets a new
 * container with fresh capability instances and isolated singleton services.
 *
 * @returns A new MCP server with the application's capabilities registered.
 */
function createAppServer(): McpServer {
  const capabilityTypes = getCapabilityTypes();
  const container = createAppContainer(capabilityTypes, providers);
  const capabilities = resolveCapabilities(container, capabilityTypes);

  return createServer(capabilities, serverConfig);
}

startStdio(createAppServer);
