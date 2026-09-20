import { inject } from "inversify";

import { tool } from "../../core/decorators";
import type { IMcpToolHandler } from "../../core/types";
import { CalculatorService } from "../../services/calculator-service";
import { AddToolInputSchema, AddToolOutputSchema } from "./add-tool.schemas";
import type { AddToolInputType, AddToolOutputType } from "./add-tool.types";

/**
 * Adds two numbers through the calculator service.
 */
@tool({
  name: "add",
  description: "Adds two numbers together.",
  inputSchema: AddToolInputSchema,
  outputSchema: AddToolOutputSchema,
})
export class AddTool implements IMcpToolHandler {
  /**
   * Creates an add tool.
   *
   * @param calculator - Calculator used by the tool.
   */
  public constructor(
    @inject(CalculatorService)
    private readonly calculator: CalculatorService,
  ) {}

  /**
   * Adds the supplied numbers.
   *
   * @param input - Validated tool input.
   * @returns The structured addition result.
   */
  public handler(input: AddToolInputType): AddToolOutputType {
    return {
      result: this.calculator.add(input.a, input.b),
    };
  }
}
