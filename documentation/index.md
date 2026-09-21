---
layout: home

hero:
  name: "MCP Starter Kit"
  text: "Class-based MCP server starter"
  tagline: Build tools, resources, and prompts in TypeScript with decorators, Zod schemas, and dependency injection.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: Generate a Capability
      link: /generating

features:
  - title: Class-based capabilities
    details: One decorated class per tool, resource, or prompt. Metadata lives on the class, handlers stay plain TypeScript.
  - title: Scaffold generator
    details: Generate a working tool, resource, prompt, or service with schemas, types, and tests. Preview with dry-run, never overwrite.
  - title: Type-safe contracts
    details: Zod schemas validate every input and argument. TypeScript types derive from those schemas, so contracts and code stay in sync.
  - title: Dependency injection
    details: Share business logic through injectable services with singleton, transient, and per-call factory lifetimes.
  - title: Inspectable registry
    details: One explicit registration list owns what your server exposes. List it from the terminal without starting the server.
  - title: Stdio-first runtime
    details: Build once, run over stdio, connect Cursor or the MCP Inspector. Logs go to stderr so stdout stays clean for protocol traffic.
---

## Build your server in four steps

```sh
npx @im4all/create-mcp-starter-kit my-server
cd my-server
npm install
npm run build
```

Then generate your first capability, register it, and run the server.

```sh
npm run generate tool multiply --dry-run
npm run generate tool multiply
npm run list:capabilities
npm start
```

New here? Start with [Getting Started](/getting-started). Already running? Go to [Generating Capabilities](/generating), then [Tools](/tools), [Resources](/resources), [Prompts](/prompts), and [Services and Injection](/services).
