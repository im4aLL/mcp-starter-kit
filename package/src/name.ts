import { ScaffoldError } from "./errors";

const MAX_NAME_LENGTH = 214;
const VALID_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

/**
 * Validates a project name against npm package naming and path-safety rules.
 *
 * Rejects empty names, uppercase or spaced names, scoped names without a
 * segment, and any value that could escape the working directory such as `..`,
 * absolute paths, or embedded path separators.
 *
 * @param name - Candidate project name.
 * @throws {ScaffoldError} When the name is not a valid, safe npm package name.
 */
export function validateProjectName(name: string): void {
  if (name.length === 0) {
    throw new ScaffoldError("Project name cannot be empty.");
  }

  if (name.length > MAX_NAME_LENGTH) {
    throw new ScaffoldError(`Project name cannot exceed ${MAX_NAME_LENGTH} characters.`);
  }

  if (!VALID_NAME_PATTERN.test(name)) {
    throw new ScaffoldError(
      `Invalid project name "${name}". Use lowercase letters, digits, dots, hyphens, or an optional @scope/ prefix.`,
    );
  }
}

/**
 * Derives the executable name for the generated project from its package name.
 *
 * @param name - Valid npm package name, optionally scoped.
 * @returns The package name without any scope prefix.
 */
export function deriveBinName(name: string): string {
  const separatorIndex = name.indexOf("/");

  if (separatorIndex === -1) {
    return name;
  }

  return name.slice(separatorIndex + 1);
}
