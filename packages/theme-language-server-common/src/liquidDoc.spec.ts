import { expect, it } from 'vitest';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { toSourceCode } from '@shopify/theme-check-common';
import { describe } from 'vitest';
import { getSnippetDefinition } from './liquidDoc';

describe('Unit: makeGetLiquidDocDefinitions', () => {
  function toAST(code: string) {
    return toSourceCode('/tmp/foo.liquid', code).ast as LiquidHtmlNode;
  }

  it('should return name if no valid annotations are present in definition', async () => {
    const ast = toAST(`
        {% doc %}
          just a description
          @undefined asdf
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [],
      },
    });
  });

  it('should extract name, description and type from param annotations', async () => {
    const ast = toAST(`
        {% doc %}
          @param {String} firstParam - The first param
          @param {Number} secondParam - The second param
          @param paramWithNoType - param with no type
          @param paramWithOnlyName
          @param {Number} paramWithNoDescription
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [
          {
            name: 'firstParam',
            description: 'The first param',
            type: 'String',
          },
          {
            name: 'secondParam',
            description: 'The second param',
            type: 'Number',
          },
          {
            name: 'paramWithNoType',
            description: 'param with no type',
            type: null,
          },
          {
            name: 'paramWithOnlyName',
            description: null,
            type: null,
          },
          {
            name: 'paramWithNoDescription',
            description: null,
            type: 'Number',
          },
        ],
      },
    });
  });
});
