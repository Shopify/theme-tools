import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { check, JSONValidator } from './index';
import { createMockConfigFile, makeTmpFolder, removeTmpFolder } from './test/test-helpers';

const appBlockAssetChecks = [
  { code: 'AssetSizeAppBlockJavaScript', property: 'javascript', asset: 'app.js' },
  { code: 'AssetSizeAppBlockCSS', property: 'stylesheet', asset: 'app.css' },
];

const outsideFileNames: [description: string, fileName: (outsideFile: string) => string][] = [
  ['a relative path', () => '../../outside.txt'],
  ['a percent-encoded relative path', () => '%2e%2e%2f%2e%2e%2foutside.txt'],
  ['a percent-encoded relative path with backslashes', () => '..%5c..%5coutside.txt'],
  ['an absolute path', (outsideFile) => outsideFile],
];

describe.each(appBlockAssetChecks)('$code', ({ code, property, asset }) => {
  let tmpDir: string;
  let root: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = await makeTmpFolder();
    root = path.join(tmpDir, 'extension');
    await fs.mkdir(path.join(root, 'assets'), { recursive: true });
    await fs.mkdir(path.join(root, 'blocks'));
    configPath = await createMockConfigFile(
      tmpDir,
      `extends: nothing\n${code}:\n  enabled: true\n  thresholdInBytes: 1\n`,
    );
    // Schema downloads are unrelated to these checks and require network access.
    vi.spyOn(JSONValidator, 'create').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await removeTmpFolder(tmpDir);
  });

  async function offenseMessages(fileName: string) {
    const schema = JSON.stringify({ [property]: fileName });
    await fs.writeFile(
      path.join(root, 'blocks', 'app.liquid'),
      `{% schema %}\n${schema}\n{% endschema %}\n`,
    );
    const offenses = await check(root, configPath);
    return offenses.map((offense) => offense.message);
  }

  it.each(outsideFileNames)(
    'gives the same offense for %s whether or not the file outside the extension exists',
    async (_description, fileNameOf) => {
      const outsideFile = path.join(tmpDir, 'outside.txt');
      const fileName = fileNameOf(outsideFile);

      const withoutOutsideFile = await offenseMessages(fileName);
      await fs.writeFile(outsideFile, 'x'.repeat(100));
      const withOutsideFile = await offenseMessages(fileName);

      expect(withOutsideFile).toEqual(withoutOutsideFile);
      expect(withOutsideFile).toEqual([
        `'${fileName}' must be the name of a file in the assets directory.`,
      ]);
    },
  );

  it('reports the size of a file in the assets directory', async () => {
    await fs.writeFile(path.join(root, 'assets', asset), 'x'.repeat(100));

    expect(await offenseMessages(asset)).toEqual([
      `The file size for '${asset}' (100 B) exceeds the configured threshold (1 B)`,
    ]);
  });
});
