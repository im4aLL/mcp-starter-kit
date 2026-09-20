import { resource } from "../../core/decorators";
import type { IMcpResourceHandler } from "../../core/types";
import type { ProjectInfo } from "./project-info.types";

/**
 * Provides static information about the starter project.
 */
@resource({
  uri: "project://info",
  name: "Project information",
  description: "Describes the MCP starter project.",
  mimeType: "text/plain",
})
export class ProjectInfoResource implements IMcpResourceHandler {
  /**
   * Returns project information.
   *
   * @param _uri - URI requested by the MCP client.
   * @returns The plain-text project description.
   */
  public handler(_uri: string): ProjectInfo {
    return "A class-based MCP server starter.";
  }
}
