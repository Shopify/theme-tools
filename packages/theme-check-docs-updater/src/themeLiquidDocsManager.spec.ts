import { expect, describe, it, beforeEach, afterEach, vi, assert } from 'vitest';
import { ThemeLiquidDocsManager } from './themeLiquidDocsManager';
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

  describe('Unit: systemTranslations', () => {
    it('should return the parsed JSON content of the system translations', async () => {
      const systemTranslations = await manager.systemTranslations();
      expect(systemTranslations).to.eql({
        'shopify.checkout.general.cart': 'Cart',
      });
    });
  });

  describe('Unit: validateSectionSchema', () => {
    it('should return a validator for the given json schema', async () => {
      const validate = await manager.validateSectionSchema();

      expect(validate).to.be.a('function');
    });

    it('should return a validator that approves valid data', async () => {
      const data = {
        name: 'John Doe',
        age: 42,
      };
      const validate = await manager.validateSectionSchema();

      const valid = validate(data);

      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should return a validator that catches data violations', async () => {
      const data = {
        name: 'John Doe',
      };
      const validate = await manager.validateSectionSchema();

      const valid = validate(data);

      // Check if the data is not valid
      expect(valid).toBe(false);
      expect(validate.errors).to.be.an('array');
      expect(validate.errors).to.have.lengthOf(1);

      // Conditional to satisfy typescript. This is already checked by the previous expect.
      if (validate.errors) {
        const error = validate.errors[0];
        expect(error.message).to.match(/'age'/);
      }
    });
  });
});
