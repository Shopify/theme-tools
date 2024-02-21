import { describe, beforeEach, it, expect } from 'vitest';
import { AugmentedThemeDocset } from './AugmentedThemeDocset';
import { ThemeDocset } from './types';

describe('Module: AugmentedThemeDocset', async () => {
  let themeDocset: ThemeDocset;

  beforeEach(async () => {
    themeDocset = new AugmentedThemeDocset({
      filters: async () => [],
      objects: async () => [],
      tags: async () => [],
      systemTranslations: async () => ({}),
    });
  });

  describe('filters', async () => {
    it('should return filters with undocumented filters', async () => {
      const filters = await themeDocset.filters();

      expect(filters).to.have.length.greaterThanOrEqual(30);
    });

    it('should return valid filter entries', async () => {
      const filters = await themeDocset.filters();

      expect(filters).to.deep.include({ name: 'h' });
    });
  });

  describe('objects', async () => {
    it('should return objects with undocumented objects', async () => {
      const objects = await themeDocset.objects();

      expect(objects).to.have.length.greaterThanOrEqual(15);
    });

    it('should return valid object entries', async () => {
      const objects = await themeDocset.objects();

      expect(objects).to.deep.include({ name: 'customer_address' });
      expect(objects).to.deep.include({
        name: 'locale',
        access: {
          global: false,
          parents: [],
          template: [],
        },
        return_type: [
          {
            type: 'string',
            name: '',
          },
        ],
      });
    });
  });

  describe('tags', async () => {
    it('should return tags with undocumented tags', async () => {
      const tags = await themeDocset.tags();

      expect(tags).have.length.greaterThanOrEqual(4);
    });

    it('should return valid tag entries', async () => {
      const tags = await themeDocset.tags();

      expect(tags).to.deep.include({ name: 'elsif' });
    });
  });
});
