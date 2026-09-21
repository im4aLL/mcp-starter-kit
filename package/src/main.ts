#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { runCli } from "./cli";

/**
 * Reads the running CLI version from the published package metadata.
 *
 * @returns The version declared in the CLI package.json.
 */
function readCliVersion(): string {
  const packageUrl = new URL("../package.json", import.meta.url);
  const parsed = JSON.parse(readFileSync(packageUrl, "utf8")) as { version: string };

  return parsed.version;
}

runCli(process.argv.slice(2), { cwd: process.cwd(), cliVersion: readCliVersion() })
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
