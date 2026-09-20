/**
 * MCP metadata owned by the `@resource` decorator.
 *
 * `mimeType` is only the `resources/list` advertisement. Contents MIME is
 * derived from the handler value by the resource mapper, even when the two
 * disagree.
 */
export interface IResourceMetadata {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType?: string;
}
