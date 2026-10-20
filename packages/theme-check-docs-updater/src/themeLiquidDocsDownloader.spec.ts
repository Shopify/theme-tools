import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceThemeLiquidDocs } from './themeLiquidDocsDownloader';

describe('Unit: replaceThemeLiquidDocs', () => {
  let dir: string;
  let source: string;
  let cache: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'theme-liquid-docs-'));
    source = path.join(dir, 'source');
    cache = path.join(dir, 'cache');
    vi.stubEnv('SHOPIFY_TLD_ROOT', source);
    const manifest = '{"schemas":[{"uri":"theme/section.json"}]}';
    await write(source, {
      'data/latest.json': '{"revision":"2"}',
      'data/filters.json': '[]',
      'data/objects.json': '[]',
      'data/tags.json': '[]',
      'data/shopify_system_translations.json': '{}',
      'schemas/manifest_theme.json': manifest,
      'schemas/manifest_theme_app_extension.json': manifest,
      'schemas/theme/section.json': '{}',
    });
    await write(cache, { 'latest.json': '{"revision":"1"}', 'removed.json': '{}' });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('replaces the docs with the complete new set', async () => {
    await replaceThemeLiquidDocs(cache, () => {});

    expect((await fs.readdir(cache)).sort()).toEqual([
      'filters.json',
      'latest.json',
      'manifest_theme.json',
      'manifest_theme_app_extension.json',
      'objects.json',
      'section.json',
      'shopify_system_translations.json',
      'tags.json',
    ]);
    expect(await fs.readFile(path.join(cache, 'latest.json'), 'utf8')).toBe('{"revision":"2"}');
    expect((await fs.readdir(dir)).sort()).toEqual(['cache', 'source']);
  });

  it('leaves the docs as they were when a download fails', async () => {
    await fs.rm(path.join(source, 'data/tags.json'));

    await expect(replaceThemeLiquidDocs(cache, () => {})).rejects.toThrow();

    expect((await fs.readdir(cache)).sort()).toEqual(['latest.json', 'removed.json']);
    expect(await fs.readFile(path.join(cache, 'latest.json'), 'utf8')).toBe('{"revision":"1"}');
    expect((await fs.readdir(dir)).sort()).toEqual(['cache', 'source']);
  });
});

async function write(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }
}
