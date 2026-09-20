import { describe, expect, it } from "vitest";

import { CalculatorService } from "../../services/calculator-service";
import { AddTool } from "./add-tool";
import { AddToolInputSchema, AddToolOutputSchema } from "./add-tool.schemas";

describe("AddTool schemas", () => {
  it("accepts numeric operands", () => {
    expect(AddToolInputSchema.safeParse({ a: 1, b: 2 }).success).toBe(true);
  });

  it("rejects nonnumeric operands", () => {
    expect(AddToolInputSchema.safeParse({ a: "1", b: 2 }).success).toBe(false);
  });

  it("rejects missing operands", () => {
    expect(AddToolInputSchema.safeParse({ a: 1 }).success).toBe(false);
  });

  it("produces object-shaped output", () => {
    expect(AddToolOutputSchema.safeParse({ result: 3 }).success).toBe(true);
    expect(AddToolOutputSchema.safeParse(3).success).toBe(false);
  });
});

describe("AddTool handler", () => {
  it("adds validated operands through the calculator service", () => {
    const tool = new AddTool(new CalculatorService());

    expect(tool.handler({ a: 1, b: 2 })).toEqual({ result: 3 });
  });
});
