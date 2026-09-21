# create-mcp-starter-kit

Scaffolds a class-based, TypeScript MCP server project from the [mcp-starter-kit](https://github.com/im4aLL/mcp-starter-kit) template.

## Prerequisites

- Node.js >= 20
- git available on `PATH`

## Usage

```sh
npx @im4all/create-mcp-starter-kit <name>
```

If `<name>` is omitted, the CLI prompts for it interactively. In CI or any non-interactive shell, always pass `<name>`: without a TTY and without a name, the CLI fails fast with a usage error instead of waiting on stdin.

Creates the directory `<name>`, clones the template at the tag matching this CLI version, removes template-only files, renames the project, patches `package.json` and `package-lock.json`, resets its version to `0.1.0`, and initializes a git repository.

Scoped names keep the scope in the package name but use the unscoped segment as the directory. For example, `@me/cool-server` creates `cool-server/` with `package.json` name `@me/cool-server`.

Then:

```sh
cd <directory>
npm install
```

For a scoped name such as `@me/cool-server`, `<directory>` is the unscoped segment (`cool-server`).

## Options

- `--tag <ref>` or `--tag=<ref>` clones a specific template tag instead of `v<cli version>`.
- `-h`, `--help` shows usage.
- `-v`, `--version` shows the CLI version.

To scaffold a specific template release, pin the CLI version:

```sh
npx @im4all/create-mcp-starter-kit@0.1.0 my-server
```

Network operations use a timeout (30s for tag lookup, 60s for clone). A timed-out operation fails with a message asking you to check your network connection.

## How the template is trimmed

The template repository ships a `.starterkitignore` file listing paths that belong only to the template itself, such as the CLI `package/` directory. The file contains one literal relative path per line (no globs, no negation); blank lines and lines starting with `#` are ignored. The CLI deletes each listed path and then removes `.starterkitignore`. The `.git` directory is always removed, and a fresh repository is initialized in its place.

## Development

```sh
npm install
npm run build
npm test
```
