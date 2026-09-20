import type { ICapabilities } from "../core/types";
import { CodeReviewPrompt } from "../prompts/code-review/code-review";
import { ProjectInfoResource } from "../resources/project-info/project-info";
import { AddTool } from "../tools/add-tool/add-tool";

/**
 * Returns the capability constructors registered by the application.
 *
 * Constructors, not instances, are listed; one instance is resolved per
 * server. This is the only capability registration list: there is no hidden
 * registry and no source scan.
 *
 * @returns Explicit tool, prompt, and resource constructor lists.
 */
export function getCapabilityTypes(): ICapabilities {
  return {
    tools: [AddTool],
    prompts: [CodeReviewPrompt],
    resources: [ProjectInfoResource],
  };
}
