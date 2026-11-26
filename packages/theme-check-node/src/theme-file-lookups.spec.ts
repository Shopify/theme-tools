import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { check, JSONValidator } from './index';
import { createMockConfigFile, makeTmpFolder, removeTmpFolder } from './test/test-helpers';

const lookups = [
  {
    code: 'MissingAsset',
    file: 'snippets/snippet.liquid',
    source: (name: string) => `{{ '${name}.js' | asset_url }}`,
    insideFile: 'assets/inside.js',
    outsideFile: 'outside.js',
    message: (name: string) => `'assets/${name}.js' does not exist`,
  },
  {
    code: 'ValidStaticBlockType',
    file: 'sections/section.liquid',
    source: (name: string) => `{% content_for "block", type: "${name}", id: "static" %}`,
    insideFile: 'blocks/inside.liquid',
    outsideFile: 'outside.liquid',
    message: (name: string) => `'blocks/${name}.liquid' does not exist`,
  },
  {
    code: 'JSONMissingSection',
    file: 'templates/index.json',
    source: (name: string) =>
      JSON.stringify({ sections: { main: { type: name } }, order: ['main'] }),
    insideFile: 'sections/inside.liquid',
    outsideFile: 'outside.liquid',
    message: (name: string) => `Section type '${name}' does not refer to an existing section file`,
  },
];

/** Names that lead from the directory a check looks in to the directory that contains the theme. */
const outsideNames: [description: string, name: string][] = [
  ['a relative path', '../../outside'],
  ['a relative path with backslashes', '..\\..\\outside'],
  ['a percent-encoded relative path', '%2e%2e%2f%2e%2e%2foutside'],
  ['a percent-encoded relative path with backslashes', '..%5c..%5coutside'],
];

describe.each(lookups)('$code', ({ code, file, source, insideFile, outsideFile, message }) => {
  let tmpDir: string;
  let root: string;
  let configPath: string;

  beforeEach(async () => {
    tmpDir = await makeTmpFolder();
    root = path.join(tmpDir, 'theme');
    for (const dir of ['assets', 'blocks', 'sections', 'snippets', 'templates']) {
      await fs.mkdir(path.join(root, dir), { recursive: true });
    }
    configPath = await createMockConfigFile(
      tmpDir,
      `extends: nothing\n${code}:\n  enabled: true\n`,
    );
    // Schema downloads are unrelated to these checks and require network access.
    vi.spyOn(JSONValidator, 'create').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await removeTmpFolder(tmpDir);
  });

  async function offenseMessages(name: string) {
    await fs.writeFile(path.join(root, file), source(name));
    const offenses = await check(root, configPath);
    return offenses.map((offense) => offense.message);
  }

  it.each(outsideNames)(
    'gives the same offense for %s whether or not the file outside the theme exists',
    async (_description, name) => {
      const withoutOutsideFile = await offenseMessages(name);
      await fs.writeFile(path.join(tmpDir, outsideFile), 'outside');
      const withOutsideFile = await offenseMessages(name);

      expect(withOutsideFile).toEqual(withoutOutsideFile);
      expect(withOutsideFile).toEqual([message(name)]);
    },
  );

  it('finds a file in the directory it looks in', async () => {
    await fs.writeFile(path.join(root, insideFile), 'inside');

    expect(await offenseMessages('inside')).toEqual([]);
  });
});
