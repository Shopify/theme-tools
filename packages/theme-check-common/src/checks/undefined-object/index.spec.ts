import { expect, describe, it } from 'vitest';
import { UndefinedObject } from './index';
import { runLiquidCheck } from '../../test';
import { Reference } from '../../types';

const snippet = `{% doc %} @param {string} x - x {% enddoc %}{{ typo }}{{ predictive_search }}`;

describe('Module: UndefinedObject', () => {
  describe('when the references cannot be read', () => {
    it('still reports undefined objects in a snippet', async () => {
      const offenses = await runLiquidCheck(UndefinedObject, snippet, 'snippets/snippet.liquid', {
        getReferences: async () => {
          throw new Error('The theme graph failed to build');
        },
      });

      expect(offenses.map((offense) => offense.message)).toEqual([
        "Unknown object 'typo' used.",
        "Unknown object 'predictive_search' used.",
      ]);
    });

    it('keeps the context of callers found before a lookup fails', async () => {
      const offenses = await runLiquidCheck(UndefinedObject, snippet, 'snippets/snippet.liquid', {
        getReferences: async (uri) => {
          if (!uri.endsWith('snippets/snippet.liquid')) throw new Error('Lookup failed');
          const source = { uri: uri.replace('snippets/snippet.liquid', 'sections/section.liquid') };
          return [{ source, target: { uri }, type: 'direct' } as Reference];
        },
      });

      expect(offenses.map((offense) => offense.message)).toEqual(["Unknown object 'typo' used."]);
    });
  });
});
