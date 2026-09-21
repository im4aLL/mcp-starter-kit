---
outline: deep
---

# Getting Started

This guide takes you from an empty folder to a running MCP server with the sample tool, resource, and prompt.

## What you get

Scaffolding creates a ready-to-run TypeScript project with one example tool that adds two numbers, one example resource that describes the project, one example prompt that requests a code review, a shared calculator service, a capability generator, automated tests, and a stdio runtime.

You copy this starter, rename it, replace the samples with your own capabilities, and connect it to any MCP client.

## Prerequisites

You need Node.js 20 or newer, npm, and git available on your PATH.

The committed lockfile is authoritative, so use `npm ci` for a clean install when the lockfile exists and `npm install` for a freshly scaffolded project.

## Option A: scaffold with the CLI (recommended)

Run the scaffolder with the name of the folder you want to create.

```sh
npx @im4all/create-mcp-starter-kit my-server
cd my-server
npm install
```

If you omit the name, the CLI asks for it interactively. In CI or any non-interactive shell, always pass the name because the CLI fails fast instead of waiting on stdin when there is no terminal.

Scoped names keep the scope in the package name but use the unscoped segment as the folder. For example, `@me/cool-server` creates a `cool-server` folder whose package name stays `@me/cool-server`.

To scaffold a specific template release, pin the CLI version or pass a tag.

```sh
npx @im4all/create-mcp-starter-kit@0.1.0 my-server
```

The scaffolder clones the template, removes template-only files, sets your project name, resets the version to `0.1.0`, and initializes a fresh git repository.

## Option B: copy the template manually

Clone the starter repository, rename the package name and binary command, rename the advertised server name and version, and replace the sample tool, resource, and prompt folders with your own. Then update the capability registry to list your replacements.

Use Option B only when you need full control over the copy. Option A already handles the renaming and cleanup.

## Make it yours

After scaffolding, rename the server identity so MCP clients see your name instead of the starter name. The server name and version have defaults in the project configuration and can be overridden per launch without code changes.

```sh
MCP_SERVER_NAME=my-server MCP_SERVER_VERSION=0.1.0 npm start
```

The shared logger follows the server name automatically, so renaming the server also renames your log records.

## Install, build, and run

From your project folder, install dependencies, build the bundle, and start the server.

```sh
npm install
npm run build
npm start
```

`npm start` runs the built bundle over stdio. For local development, run TypeScript directly without building.

```sh
npm run dev
```

To verify the sample server with a visual client, build first and then launch the MCP Inspector.

```sh
npm run inspect
```

## Verify your setup

Run the capability listing to confirm the three samples are registered. It reads decorator metadata only and never starts the server.

```sh
npm run list:capabilities
```

Run checks to confirm types, tests, and style all pass.

```sh
npm run typecheck
npm test
npm run lint
```

If those three pass and the Inspector shows one tool, one resource, and one prompt, your setup works.

## Next steps

Generate your first real capability in [Generating Capabilities](/generating). Then learn each kind in [Tools](/tools), [Resources](/resources), [Prompts](/prompts), and shared logic in [Services and Injection](/services). When you are ready to use the server daily, read [Running and Integrating](/running).
