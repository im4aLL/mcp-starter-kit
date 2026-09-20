import { injectable } from "inversify";

/**
 * Deterministic arithmetic dependency used by {@link AddTool}.
 *
 * This is an ordinary service, not a capability, so it uses Inversify's
 * `@injectable()` directly. Its concrete class is its service identifier
 * because the starter has one implementation and no interface boundary.
 */
@injectable()
export class CalculatorService {
  /**
   * Adds two numbers.
   *
   * @param a - First operand.
   * @param b - Second operand.
   * @returns The arithmetic sum.
   */
  public add(a: number, b: number): number {
    return a + b;
  }
}
