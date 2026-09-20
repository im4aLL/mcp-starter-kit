import type { Newable } from "inversify";

import type { IMcpPromptHandler, IMcpResourceHandler, IMcpToolHandler } from "./handler.types";
import type { IToolMetadata } from "./tool.types";

/**
 * Explicit capability constructor lists registered by the application.
 *
 * This is the only registration list. Decorators never create a hidden
 * registry and the resolver never scans modules.
 */
export interface ICapabilities {
  readonly tools: readonly Newable<IMcpToolHandler>[];
  readonly prompts: readonly Newable<IMcpPromptHandler>[];
  readonly resources: readonly Newable<IMcpResourceHandler>[];
}

/**
 * A capability constructor paired with its decorator metadata.
 */
export interface IResolvedTool {
  readonly metadata: IToolMetadata;
  readonly instance: IMcpToolHandler;
}

/**
 * Runtime capability shape consumed by server registration.
 *
 * Prompts and resources are deferred, so only resolved tools are produced.
 */
export interface IResolvedCapabilities {
  readonly tools: readonly IResolvedTool[];
}
