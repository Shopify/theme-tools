import { expect, describe, it } from 'vitest';
import { OrphanedSnippet } from './index';
import { runLiquidCheck } from '../../test';

describe('Module: OrphanedSnippet', () => {
  describe('when the snippet is not referenced by any files', () => {
    it('should report a warning', async () => {
      const sourceCode = `<div>Orphaned content</div>`;

      const offenses = await runLiquidCheck(
        OrphanedSnippet,
        sourceCode,
        'snippets/orphaned.liquid',
        {
          getReferences: async (uri) => [],
        },
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe('This snippet is not referenced by any other files');
    });
  });

  describe('when the snippet is referenced by other files', () => {
    it('should not report a warning', async () => {
      const sourceCode = `<div>Referenced snippet</div>`;

      const offenses = await runLiquidCheck(
        OrphanedSnippet,
        sourceCode,
        'snippets/product-card.liquid',
        {
          getReferences: async (uri) => [
            {
              source: { uri: 'templates/product.liquid' },
              target: { uri: 'snippets/product-card.liquid' },
              type: 'direct',
            },
          ],
        },
      );

      expect(offenses).toHaveLength(0);
    });
  });

  describe('when checking non-snippet files', () => {
    it('should not report warnings for templates', async () => {
      const sourceCode = `{% section 'header' %}`;

      const offenses = await runLiquidCheck(OrphanedSnippet, sourceCode, 'templates/index.liquid', {
        getReferences: async (uri) => [],
      });

      expect(offenses).toHaveLength(0);
    });
  });
});
