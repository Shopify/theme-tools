import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { ThemeLiquidDocsManager } from './themeLiquidDocsManager';
import fs from 'node:fs/promises';
import { downloadFile, Resources } from './themeLiquidDocsDownloader';

vi.mock('./themeLiquidDocsDownloader', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    downloadFile: vi.fn(),
  };
});

vi.mock('node:path', async () => {
  return {
    default: {
      join: (...paths: string[]) => paths.join('/'),
      resolve: () => '.',
    },
  };
});

vi.mock('env-paths', async () => {
  return {
    default: (appPath: string) => ({ cache: `MOCKED_CACHE/${appPath}` }),
  };
});

vi.mock('node:fs/promises', async () => {
  const fileSystem: Record<string, string> = {
    'MOCKED_CACHE/theme-liquid-docs/filters.json': '[{"name": "upcase"}]',
    'MOCKED_CACHE/theme-liquid-docs/objects.json': '[{"name": "product"}]',
    'MOCKED_CACHE/theme-liquid-docs/tags.json': '[{"name": "if"}]',
    'MOCKED_CACHE/theme-liquid-docs/latest.json': '{"revision": "1"}',
    'MOCKED_CACHE/theme-liquid-docs/section_schema.json':
      '{ "$schema": "...",  "title": "section schema" }',
  };

  return {
    default: {
      readFile: vi.fn().mockImplementation((path) => fileSystem[path]),
    },
  };
});

describe('Module: ThemeLiquidDocsManager', async () => {
  let manager: ThemeLiquidDocsManager;

  beforeEach(async () => {
    manager = new ThemeLiquidDocsManager();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it('should self update once for all docsets', async () => {
    vi.mocked(fs.readFile)
      .mockImplementationOnce(async () => '{"revision": "1"}')
      .mockImplementationOnce(async () => '{"revision": "2"}');
    await Promise.all([manager.filters(), manager.objects(), manager.tags()]);
    expect(vi.mocked(downloadFile)).toHaveBeenNthCalledWith(1, 'latest', expect.any(String));
    for (const resource of Resources) {
      expect(vi.mocked(downloadFile)).toHaveBeenCalledWith(resource, expect.any(String));
    }
  });

  it('should not download remote files if the revision is stable', async () => {
    await Promise.all([manager.filters(), manager.objects(), manager.tags()]);
    expect(vi.mocked(downloadFile)).toHaveBeenNthCalledWith(1, 'latest', expect.any(String));
    expect(vi.mocked(downloadFile)).toHaveBeenCalledTimes(1);
    for (const resource of Resources) {
      expect(vi.mocked(downloadFile)).not.toHaveBeenCalledWith(resource, expect.any(String));
    }
  });

  describe('Unit: filters', () => {
    it('should return an array', async () => {
      const filters = await manager.filters();
      expect(filters).to.eql([{ name: 'upcase' }]);
    });
  });

  describe('Unit: objects', () => {
    it('should return an array', async () => {
      const objects = await manager.objects();
      expect(objects).to.eql([{ name: 'product' }]);
    });
  });

  describe('Unit: tags', () => {
    it('should return an array', async () => {
      const tags = await manager.tags();
      expect(tags).to.eql([{ name: 'if' }]);
    });
  });

  describe('Unit: sectionSchema', () => {
    it('should return an array', async () => {
      const sectionSchema = await manager.sectionSchema();
      expect(sectionSchema).to.eql({ $schema: '...', title: 'section schema' });
    });
  });
});
