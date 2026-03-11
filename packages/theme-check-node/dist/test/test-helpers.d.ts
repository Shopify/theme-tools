export declare function makeTmpFolder(): Promise<string>;
export declare function removeTmpFolder(tempDir: string): Promise<void>;
export declare function createMockConfigFile(tempDir: string, contents?: string, relativePath?: string): Promise<string>;
export declare const mockNodeModuleCheck = "\n  const NodeModuleCheck = {\n    meta: {\n      name: 'NodeModuleCheck',\n      code: 'NodeModuleCheck',\n      docs: { description: '...' },\n      schema: {},\n      severity: 0,\n      targets: [],\n      type: 'LiquidHtml',\n    },\n    create() {\n      return {};\n    },\n  };\n\n  exports.checks = [\n    NodeModuleCheck,\n  ];\n";
export declare function createMockNodeModule(tempDir: string, moduleName: string, moduleContent?: string): Promise<string>;
export type Tree = {
    [k in string]: Tree | string;
};
export interface Workspace {
    rootUri: string;
    uri(relativePath: string): string;
    clean(): Promise<any>;
}
export declare function makeTempWorkspace(structure: Tree): Promise<Workspace>;
