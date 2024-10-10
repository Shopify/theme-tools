import * as mktemp from 'mktemp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function makeTmpFolder() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
  await fs.mkdir(path.join(tmpDir, '.git'));
  return tmpDir;
}

export async function removeTmpFolder(tempDir: string) {
  return fs.rm(tempDir, { recursive: true, force: true });
}

export async function createMockConfigFile(
  tempDir: string,
  contents: string = 'dummy content',
  relativePath: string = '.theme-check.yml',
): Promise<string> {
  const filePath = path.join(tempDir, relativePath);
  await fs.writeFile(filePath, contents, 'utf8');
  return filePath;
}

export const mockNodeModuleCheck = `
  const NodeModuleCheck = {
    meta: {
      name: 'NodeModuleCheck',
      code: 'NodeModuleCheck',
      docs: { description: '...' },
      schema: {},
      severity: 0,
      targets: [],
      type: 'LiquidHtml',
    },
    create() {
      return {};
    },
  };

  exports.checks = [
    NodeModuleCheck,
  ];
`;

export async function createMockNodeModule(
  tempDir: string,
  moduleName: string,
  moduleContent: string = mockNodeModuleCheck,
): Promise<string> {
  const nodeModuleRoot = path.join(tempDir, 'node_modules', ...moduleName.split('/'));
  await fs.mkdir(nodeModuleRoot, { recursive: true });
  await fs.writeFile(
    path.join(nodeModuleRoot, 'package.json'),
    JSON.stringify({
      name: moduleName,
      main: './index.js',
    }),
    'utf8',
  );
  await fs.writeFile(path.join(nodeModuleRoot, 'index.js'), moduleContent);
  return nodeModuleRoot;
}

export type Tree = {
  [k in string]: Tree | string;
};

export interface Workspace {
  rootUri: string;
  path(relativePath: string): string;
  clean(): Promise<any>;
}

export async function makeTempWorkspace(structure: Tree): Promise<Workspace> {
  const root = await mktemp.createDir(path.join(__dirname, '..', '.XXXXX'));
  if (!root) throw new Error('Could not create temp dir for temp workspace');

  await createFiles(structure, [root]);

  return {
    rootUri: 'file:' + root,
    path: (relativePath) => path.join(root, ...relativePath.split('/')),
    clean: async () => fs.rm(root, { recursive: true, force: true }),
  };

  function createFiles(tree: Tree, ancestors: string[]): Promise<any> {
    const promises: Promise<any>[] = [];
    for (const [pathEl, value] of Object.entries(tree)) {
      if (typeof value === 'string') {
        promises.push(fs.writeFile(path.join(...ancestors, pathEl), value, 'utf8'));
      } else {
        promises.push(
          fs
            .mkdir(path.join(...ancestors, pathEl))
            .then(() => createFiles(value, ancestors.concat(pathEl))),
        );
      }
    }
    return Promise.all(promises);
  }
}
