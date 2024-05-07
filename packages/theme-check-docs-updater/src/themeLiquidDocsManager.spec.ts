import { expect, describe, it, beforeEach, afterEach, vi, assert } from 'vitest';
import { ThemeLiquidDocsManager } from './themeLiquidDocsManager';
import { downloadResource, Resources } from './themeLiquidDocsDownloader';
import { noop } from './utils';

vi.mock('./themeLiquidDocsDownloader', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    downloadResource: vi.fn(),
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
      '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}',
    'MOCKED_CACHE/theme-liquid-docs/shopify_system_translations.json':
      '{"shopify.checkout.general.cart": "Cart"}',
  };

  return {
    default: {
      readFile: vi.fn().mockImplementation((path) => fileSystem[path]),
      mkdir: vi.fn(),
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

  it('should not download remote files if the revision is stable', async () => {
    await Promise.all([manager.filters(), manager.objects(), manager.tags()]);
    expect(vi.mocked(downloadResource)).toHaveBeenNthCalledWith(
      1,
      'latest',
      'MOCKED_CACHE/theme-liquid-docs',
      noop,
    );
    expect(vi.mocked(downloadResource)).toHaveBeenCalledTimes(1);
    for (const resource of Resources) {
      expect(vi.mocked(downloadResource)).not.toHaveBeenCalledWith(resource, expect.any(String));
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

  describe('Unit: systemTranslations', () => {
    it('should return the parsed JSON content of the system translations', async () => {
      const systemTranslations = await manager.systemTranslations();
      expect(systemTranslations).to.eql({
        'shopify.checkout.general.cart': 'Cart',
      });
    });
  });
});
