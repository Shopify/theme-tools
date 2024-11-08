import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes,
  SourceCodeType,
  toSourceCode,
} from '@shopify/theme-check-common';
import { expect, describe, it } from 'vitest';
import { Visitor, visit } from './visitor';

describe('Module: visitor', () => {
  it('should return an array of the return type of the visitor', () => {
    const visitor: Visitor<SourceCodeType.LiquidHtml, string> = {
      LiquidTag: (node) => {
        if (node.name !== 'render' && node.name !== 'include') {
          return;
        }

        if (
          typeof node.markup === 'string' ||
          node.markup.snippet.type === LiquidHtmlNodeTypes.VariableLookup
        ) {
          return;
        }

        return node.markup.snippet.value;
      },
    };

    const ast = toAST(`
      {% render 'a' %}
      {% render block %}
      {% include 'b' %}
    `);

    expect(visit(ast!, visitor)).to.eql(['a', 'b']);
  });

  function toAST(code: string) {
    return toSourceCode('/tmp/foo.liquid', code).ast as LiquidHtmlNode;
  }
});
