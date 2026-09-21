import type { IParsedArgs } from "./cli.types";
import { ScaffoldError } from "./errors";

/**
 * Parses command-line arguments into scaffold options and flags.
 *
 * @param argv - Arguments after the executable and script path.
 * @returns The parsed project name, template tag, and flags.
 * @throws {ScaffoldError} When an unknown option or extra positional is provided.
 */
export function parseArgs(argv: string[]): IParsedArgs {
  const parsed: IParsedArgs = { help: false, version: false };
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;

      continue;
    }

    if (argument === "--version" || argument === "-v") {
      parsed.version = true;

      continue;
    }

    if (argument === "--tag") {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("-") || value.trim().length === 0) {
        throw new ScaffoldError("Option --tag requires a value.");
      }

      parsed.tag = value.trim();
      index += 1;

      continue;
    }

    if (argument.startsWith("--tag=")) {
      const value = argument.slice("--tag=".length);

      if (value.trim().length === 0) {
        throw new ScaffoldError("Option --tag requires a value.");
      }

      parsed.tag = value.trim();

      continue;
    }

    if (argument.startsWith("-")) {
      throw new ScaffoldError(`Unknown option: ${argument}`);
    }

    positionals.push(argument);
  }

  if (positionals.length > 1) {
    throw new ScaffoldError("Expected a single project name.");
  }

  if (positionals.length === 1) {
    parsed.name = positionals[0];
  }

  return parsed;
}
