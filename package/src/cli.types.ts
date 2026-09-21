export interface IParsedArgs {
  name?: string;
  tag?: string;
  help: boolean;
  version: boolean;
}

export interface ICliContext {
  cwd: string;
  cliVersion: string;
}

export interface IRenameInput {
  name: string;
  binName: string;
  version: string;
}

export interface IRenameFiles {
  token: string;
  paths: string[];
}

export interface ICliDependencies {
  resolveTemplateTag: (repository: string, explicitTag: string | undefined, cliVersion: string) => Promise<string>;
  cloneTemplate: (repository: string, tag: string, targetDir: string) => Promise<void>;
  pruneTemplate: (root: string, fileName: string) => Promise<void>;
  applyRename: (root: string, input: IRenameInput, files: IRenameFiles) => Promise<void>;
  initRepository: (root: string) => Promise<boolean>;
  promptForName: () => Promise<string>;
}
