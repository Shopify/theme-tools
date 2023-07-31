import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

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
