---
outline: deep
---

# Running and Integrating

This guide covers daily commands, environment configuration, connecting MCP clients, and inspecting your server.

## Daily commands

Run these from your project folder.

```sh
npm run dev                 # run TypeScript directly during development
npm run build               # bundle to the distributable entry point
npm start                   # run the built server over stdio
npm run inspect             # build and open the MCP Inspector
npm run list:capabilities   # print registered tools, resources, and prompts
npm run generate -- --help  # generator usage (use --dry-run to preview)
npm run typecheck           # static type check
npm test                    # typecheck plus test suite
npm run lint                # style and correctness checks
```

Use `npm run dev` for fast iteration and `npm run build` plus `npm start` for the exact artifact that clients will launch. Always rebuild before connecting a client so the client sees your latest code.

## Configure with environment variables

Three variables control runtime behavior without code changes.

`MCP_SERVER_NAME` overrides the advertised server name. `MCP_SERVER_VERSION` overrides the advertised version. `LOG_LEVEL` overrides the default `info` log level.

```sh
MCP_SERVER_NAME=my-server MCP_SERVER_VERSION=0.1.0 LOG_LEVEL=debug npm start
```

The logger writes newline-delimited JSON to stderr. Stdout is reserved for MCP protocol traffic, so every log line goes to stderr by design. Never write client-visible data to stdout from your handlers or services.

## List what your server exposes

The listing command prints every registered capability as a table with stable type, name, identifier, and description columns. Rows sort by type (tool, then resource, then prompt) and then by name. A resource identifier is its URI; a tool or prompt identifier is its MCP name.

```sh
npm run list:capabilities
```

Listing reads decorator metadata only. It never creates a container, resolves dependencies, calls a handler, starts a transport, or loads service providers. Use it as a fast, side-effect-free check after every registration change.

Listing fails with actionable guidance instead of an incomplete table when metadata is missing, a decorator kind is wrong, one class carries multiple capability decorators, identifiers collide, or the registry is empty. See [Troubleshooting](/troubleshooting) for each case.

## Connect Cursor

Build first, then point Cursor at the built entry point with a plain `node` launch. Use your own absolute path to the built file in your project.

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["<path-to-your-project>/dist/main.js"]
    }
  }
}
```

Rename the `mcpServers` key when you rename your project. Prefer the direct `node` launch over package-runner shortcuts because it is more reliable for local stdio servers.

## Connect other MCP clients

Any stdio-capable MCP client can launch the built entry point the same way: command `node` with the built file as its argument. Pass `MCP_SERVER_NAME` and related variables through the client configuration when you need per-launch identity or log levels.

## Inspect visually

The Inspector shows your tools, resources, and prompts in a browser UI and lets you invoke them manually. It is the fastest way to confirm schemas, descriptions, and handler behavior end to end.

```sh
npm run build
npx @modelcontextprotocol/inspector node dist/main.js
```

The shortcut `npm run inspect` performs the same build plus launch in one step.

## Replace the samples

When you are ready to ship your own server, delete the sample tool, resource, and prompt folders, remove their constructors from the capability registry function `getCapabilityTypes()`, and replace the sample service with your own. Update the project configuration name and version, rebuild, and confirm the listing shows only your capabilities.

## Know the transport scope

Stdio is the only transport in this starter. That keeps local use simple and predictable: one process, one connection, JSON-RPC over standard input and output.

HTTP, OAuth, and package publication are intentionally out of scope. The server factory that wires the container and capabilities is the seam where a future network transport would attach, but you do not need to change it for normal capability work.
