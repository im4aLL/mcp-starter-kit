/**
 * Prints command usage to standard output.
 */
export function printUsage(): void {
  const lines = [
    "Usage: create-mcp-starter-kit <name> [--tag <ref>]",
    "",
    "Scaffolds a class-based MCP server from the mcp-starter-kit template.",
    "",
    "Arguments:",
    "  <name>        Project directory and npm package name.",
    "",
    "Options:",
    "  --tag <ref>   Template git tag to clone. Defaults to v<cli version>.",
    "  -h, --help    Show this help.",
    "  -v, --version Show the CLI version.",
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

/**
 * Prints the CLI version to standard output.
 *
 * @param version - Running CLI package version.
 */
export function printVersion(version: string): void {
  process.stdout.write(`${version}\n`);
}

/**
 * Prints a progress message to standard output.
 *
 * @param message - Message to display.
 */
export function info(message: string): void {
  process.stdout.write(`${message}\n`);
}

/**
 * Prints a failure message to standard error.
 *
 * @param message - Message to display.
 */
export function fail(message: string): void {
  process.stderr.write(`${message}\n`);
}

/**
 * Prints a warning message to standard error.
 *
 * @param message - Message to display.
 */
export function warn(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}

/**
 * Prints the post-scaffold next steps to standard output.
 *
 * @param directoryName - Generated project directory name.
 */
export function printNextSteps(directoryName: string): void {
  const lines = ["", `Created ${directoryName}.`, "", "Next steps:", `  cd ${directoryName}`, "  npm install"];

  process.stdout.write(`${lines.join("\n")}\n`);
}
