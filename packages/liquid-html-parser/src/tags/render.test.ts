import { describe, expect, it } from 'vitest';
import { renderTag, includeTag } from './render';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('renderTag', () => {
  it('has standalone kind', () => {
    expect(renderTag.kind).toBe(TagKind.Tag);
  });

  it('parses a string snippet with no variable or args', () => {
    const result = renderTag.parse('render', parser("'snippet'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.String, value: 'snippet', single: true },
      variable: null,
      alias: null,
      args: [],
    });
  });

  it('parses with keyword and variable', () => {
    const markup = "'snippet' with product";
    const source = PADDING + markup;
    const result = renderTag.parse('render', parser(markup), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.String, value: 'snippet' },
      variable: {
        type: NodeTypes.RenderVariableExpression,
        kind: 'with',
        name: { type: NodeTypes.VariableLookup, name: 'product' },
      },
      alias: null,
      args: [],
    });
    // RenderMarkup position spans from snippet to last element
    expect(source.slice(result.position.start, result.position.end)).toBe(markup);
  });

  it('parses for keyword with alias', () => {
    const markup = "'snippet' for products as item";
    const source = PADDING + markup;
    const result = renderTag.parse('render', parser(markup), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.String, value: 'snippet' },
      variable: {
        type: NodeTypes.RenderVariableExpression,
        kind: 'for',
        name: { type: NodeTypes.VariableLookup, name: 'products' },
      },
      alias: {
        type: NodeTypes.RenderAliasExpression,
        value: 'item',
      },
    });
    // RenderVariableExpression and RenderAliasExpression position assertions
    expect(source.slice(result.variable!.position.start, result.variable!.position.end)).toBe(
      'for products',
    );
    expect(source.slice(result.alias!.position.start, result.alias!.position.end)).toBe('as item');
  });

  it('parses named arguments without variable', () => {
    const result = renderTag.parse('render', parser("'snippet', var: expr"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.String, value: 'snippet' },
      variable: null,
      alias: null,
      args: [
        {
          type: NodeTypes.NamedArgument,
          name: 'var',
          value: { type: NodeTypes.VariableLookup, name: 'expr' },
        },
      ],
    });
  });

  it('parses with keyword and named arguments', () => {
    const result = renderTag.parse(
      'render',
      parser("'snippet' with product, class: 'card'"),
      stubParser,
    );
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.String, value: 'snippet' },
      variable: {
        type: NodeTypes.RenderVariableExpression,
        kind: 'with',
        name: { type: NodeTypes.VariableLookup, name: 'product' },
      },
      alias: null,
      args: [
        {
          type: NodeTypes.NamedArgument,
          name: 'class',
          value: { type: NodeTypes.String, value: 'card' },
        },
      ],
    });
  });

  it('parses named arguments with trailing comma', () => {
    const markup =
      "'slideshow-slide', index: forloop.index0, children: children, media_fit: block_settings.media_fit,";
    const mp = parser(markup);
    const result = renderTag.parse('render', mp, stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.String, value: 'slideshow-slide' },
      variable: null,
      alias: null,
      args: [
        { type: NodeTypes.NamedArgument, name: 'index' },
        { type: NodeTypes.NamedArgument, name: 'children' },
        { type: NodeTypes.NamedArgument, name: 'media_fit' },
      ],
    });
    expect(result.args).toHaveLength(3);
    expect(mp.isAtEnd()).toBe(true);
  });

  it('parses a variable lookup snippet (no quotes)', () => {
    const result = renderTag.parse('render', parser('variable_name'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.VariableLookup, name: 'variable_name' },
      variable: null,
      alias: null,
      args: [],
    });
  });

  // Ruby render/include strict2_parse treat the comma between named args as
  // optional (`p.consume?(:comma)`), so the space-separated form is valid.
  it('parses space-separated named arguments (optional comma)', () => {
    const mp = parser("'snippet' a: 1 b: 2 c: 3");
    const result = renderTag.parse('render', mp, stubParser);
    expect(result.args).toMatchObject([
      { type: NodeTypes.NamedArgument, name: 'a' },
      { type: NodeTypes.NamedArgument, name: 'b' },
      { type: NodeTypes.NamedArgument, name: 'c' },
    ]);
    expect(mp.isAtEnd()).toBe(true);
  });

  it('parses mixed comma / no-comma named arguments', () => {
    const mp = parser("'snippet', a: 1 b: 2, c: 3");
    const result = renderTag.parse('render', mp, stubParser);
    expect(result.args).toHaveLength(3);
    expect(mp.isAtEnd()).toBe(true);
  });

  // Ruby render/include strict2_parse keys are a bare `id` immediately followed
  // by a colon (`key = p.consume; p.consume(:colon)`), NOT a dotted path. A
  // dotted key is not consumed as a named arg, leaving trailing tokens that fail
  // the tag's end-of-string check (surfaced as a strict parse error upstream).
  it('does not treat a dotted key as a named argument', () => {
    const mp = parser("'snippet' closest.product: x");
    const result = renderTag.parse('render', mp, stubParser);
    expect(result.args).toHaveLength(0);
    expect(mp.isAtEnd()).toBe(false);
  });
});

describe('includeTag', () => {
  it('has standalone kind', () => {
    expect(includeTag.kind).toBe(TagKind.Tag);
  });

  // Ruby `include` accepts any expression as the template name at parse time and
  // only raises "Illegal template name" at render time when it is not a String
  // (include.rb). `render` keeps the stricter parse-time quoted-string rule.
  it('parses a numeric (non-string) template name', () => {
    const result = includeTag.parse('include', parser('123'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.Number },
      args: [],
    });
  });

  it('parses a nil/literal template name', () => {
    const result = includeTag.parse('include', parser('nil'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.RenderMarkup,
      snippet: { type: NodeTypes.LiquidLiteral },
    });
  });

  it('parses a string template name with space-separated args', () => {
    const mp = parser("'snippet' a: 1 b: 2");
    const result = includeTag.parse('include', mp, stubParser);
    expect(result.snippet).toMatchObject({ type: NodeTypes.String, value: 'snippet' });
    expect(result.args).toHaveLength(2);
    expect(mp.isAtEnd()).toBe(true);
  });

  it('rejects a non-string template name for render (stricter parse)', () => {
    expect(() => renderTag.parse('render', parser('123'), stubParser)).toThrow();
  });
});
