import { LiquidHtmlNode, LiquidHtmlNodeTypes, SourceCodeType } from './types';
import { toJSONAST, toLiquidHTMLAST, toSourceCode } from './to-source-code';
import { expect, describe, it, assert } from 'vitest';
import { Visitor, findCurrentNode, findJSONNode, visit } from './visitor';
import { NodeTypes } from '@shopify/liquid-html-parser';

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

describe('findCurrentNode', () => {
  it.each([
    {
      desc: 'at the end of a tag name',
      source: '{% render█ "a" %}',
      expected: NodeTypes.LiquidTag,
      ancestors: [NodeTypes.Document],
    },
    {
      desc: 'at the end of a lookup',
      source: '{{ product.title█ }}',
      expected: NodeTypes.String,
      ancestors: [
        NodeTypes.Document,
        NodeTypes.LiquidVariableOutput,
        NodeTypes.LiquidVariable,
        NodeTypes.VariableLookup,
      ],
    },
    {
      desc: 'at the beginning of a lookup',
      source: '{{ product.█title }}',
      expected: NodeTypes.String,
      ancestors: [
        NodeTypes.Document,
        NodeTypes.LiquidVariableOutput,
        NodeTypes.LiquidVariable,
        NodeTypes.VariableLookup,
      ],
    },
    {
      desc: 'at the start of a condition',
      source: '{% if █cond %}{% endif %}',
      expected: NodeTypes.VariableLookup,
      ancestors: [NodeTypes.Document, NodeTypes.LiquidTag],
    },
    {
      desc: 'at the start of a child condition',
      source: '{% if cond %}{% elsif █cond %}{% endif %}',
      expected: NodeTypes.VariableLookup,
      ancestors: [NodeTypes.Document, NodeTypes.LiquidTag, NodeTypes.LiquidBranch],
    },
    {
      desc: 'at the start of a comparison',
      source: '{% if █cond < b %}{% endif %}',
      expected: NodeTypes.VariableLookup,
      ancestors: [NodeTypes.Document, NodeTypes.LiquidTag, NodeTypes.Comparison],
    },
    {
      desc: 'at the start of a logical expression',
      source: '{% if █cond and b %}{% endif %}',
      expected: NodeTypes.VariableLookup,
      ancestors: [NodeTypes.Document, NodeTypes.LiquidTag, NodeTypes.LogicalExpression],
    },
    {
      desc: 'at the start of a named-variable variable lookup',
      source: '{{ product[█key] }}',
      expected: NodeTypes.VariableLookup,
      ancestors: [
        NodeTypes.Document,
        NodeTypes.LiquidVariableOutput,
        NodeTypes.LiquidVariable,
        NodeTypes.VariableLookup,
      ],
    },
    {
      desc: 'between the end of a text node and the start of a tag',
      source: '{% if open %}<div>foo█{% else %}</div>{% endif %}',
      expected: NodeTypes.TextNode,
      ancestors: [
        NodeTypes.Document,
        NodeTypes.LiquidTag,
        NodeTypes.LiquidBranch,
        NodeTypes.HtmlElement,
      ],
    },
  ])('should find the current node and ancestors when $desc', ({ source, expected, ancestors }) => {
    const CURSOR = '█';
    const offset = source.indexOf(CURSOR);
    const ast = toLiquidHTMLAST(source.replace(CURSOR, ''));
    assert(!(ast instanceof Error), 'AST should not be an error');

    const [currentNode, actualAncestors] = findCurrentNode(ast, offset);

    expect(actualAncestors.map((x) => x.type)).to.eql(ancestors, `In "${source}"`);
    expect(currentNode.type).to.equal(expected, `In "${source}"`);
  });

  describe('findJSONNode', () => {
    it.each([
      {
        desc: 'string value',
        source: '{ "key": "█t:value" }',
        expected: 'Literal',
        ancestors: ['Object', 'Property'],
      },
      {
        desc: 'string key',
        source: '{ "█key": "t:value" }',
        expected: 'Identifier',
        ancestors: ['Object', 'Property'],
      },
      {
        desc: 'nested string value',
        source: '{ "key": { "key2": "█t:value" } }',
        expected: 'Literal',
        ancestors: ['Object', 'Property', 'Object', 'Property'],
      },
    ])(
      'should find the current node when the target is $desc',
      ({ source, expected, ancestors }) => {
        const CURSOR = '█';
        const offset = source.indexOf(CURSOR);
        const ast = toJSONAST(source.replace(CURSOR, ''));
        assert(!(ast instanceof Error), 'AST should not be an error');

        const [currentNode, actualAncestors] = findJSONNode(ast, offset);

        expect(actualAncestors.map((x) => x.type)).to.eql(ancestors, `In "${source}"`);
        expect(currentNode.type).to.equal(expected, `In "${source}"`);
      },
    );
  });
});
