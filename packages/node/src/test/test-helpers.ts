import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function makeTmpFolder() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
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
