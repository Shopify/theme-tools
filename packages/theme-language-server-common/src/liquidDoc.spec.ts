import { expect, it } from 'vitest';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { toSourceCode } from '@shopify/theme-check-common';
import { describe } from 'vitest';
import { getSnippetDefinition } from './liquidDoc';

describe('Unit: getSnippetDefinition', () => {
  function toAST(code: string) {
    return toSourceCode('/tmp/foo.liquid', code).ast as LiquidHtmlNode;
  }

  it('should return default snippet definition if no renderable content is present', async () => {
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
          @param {String} [optionalParam] - The optional param
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
            required: true,
          },
          {
            name: 'secondParam',
            description: 'The second param',
            type: 'Number',
            required: true,
          },
          {
            name: 'optionalParam',
            description: 'The optional param',
            type: 'String',
            required: false,
          },
          {
            name: 'paramWithNoType',
            description: 'param with no type',
            type: null,
            required: true,
          },
          {
            name: 'paramWithOnlyName',
            description: null,
            type: null,
            required: true,
          },
          {
            name: 'paramWithNoDescription',
            description: null,
            type: 'Number',
            required: true,
          },
        ],
      },
    });
  });
});
