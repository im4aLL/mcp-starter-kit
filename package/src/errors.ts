/**
 * Error raised for expected, user-facing scaffolding failures.
 *
 * Errors of this type are printed as a single message without a stack trace.
 */
export class ScaffoldError extends Error {
  /**
   * Creates a scaffold error.
   *
   * @param message - Human-readable description of the failure.
   */
  constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}
