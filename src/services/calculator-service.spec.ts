import { describe, expect, it } from "vitest";

import { CalculatorService } from "./calculator-service";

describe("CalculatorService", () => {
  it("adds two numbers", () => {
    const calculator = new CalculatorService();

    expect(calculator.add(1, 2)).toBe(3);
  });

  it("adds negative and zero operands", () => {
    const calculator = new CalculatorService();

    expect(calculator.add(-1, 1)).toBe(0);
    expect(calculator.add(0, 0)).toBe(0);
  });
});
