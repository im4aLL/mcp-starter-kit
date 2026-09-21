export const TEMPLATE_REPOSITORY = "https://github.com/im4aLL/mcp-starter-kit.git";

export const DEFAULT_PROJECT_VERSION = "0.1.0";

export const STARTERKIT_IGNORE_FILE = ".starterkitignore";

export const TEMPLATE_NAME_TOKEN = "mcp-starter-kit";

export const GIT_LS_REMOTE_TIMEOUT_MS = 30000;

export const GIT_CLONE_TIMEOUT_MS = 60000;

// Text files whose template name token is replaced with the project name.
// `src/config.ts` is edited structurally instead of by token replacement.
export const TEMPLATE_TOKEN_FILES = [
  "README.md",
  "src/main.smoke.spec.ts",
  "src/config.spec.ts",
  "src/core/capability-metadata.ts",
];
