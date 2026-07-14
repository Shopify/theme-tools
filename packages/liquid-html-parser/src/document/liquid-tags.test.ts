import { describe, expect, it } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import { expectPath, expectPosition, sourceAt } from './test-helpers';

describe('Unit: liquid-tags', () => {
  it('should parse unknown tag as base case', () => {
    const ast = toLiquidHtmlAST('{% unknown_tag %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('unknown_tag');
    expectPath(ast, 'children.0.markup').to.eql('');
    expectPath(ast, 'children.0.children').to.eql(undefined);
  });

  it('should parse unknown tag with markup', () => {
    const ast = toLiquidHtmlAST('{% unknown_tag foo bar %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('unknown_tag');
    expectPath(ast, 'children.0.markup').to.eql('foo bar');
  });

  it('should parse inline comment # (empty)', () => {
    const ast = toLiquidHtmlAST('{% #%}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('#');
    expectPath(ast, 'children.0.markup').to.eql('');
  });

  it('should parse inline comment # (with content)', () => {
    const ast = toLiquidHtmlAST('{% #hello world %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('#');
    expectPath(ast, 'children.0.markup').to.eql('hello world');
  });

  it.each([
    ['{% # hello %}', 'hello', ' hello '],
    ['{% #%}', '', ''],
    ['{% #hello world %}', 'hello world', 'hello world '],
    ['{% #ok\nfoo %}', 'ok\nfoo', 'ok\nfoo '],
  ])('should expose inline comment raw markup for %s', (source, markup, rawMarkup) => {
    const ast = toLiquidHtmlAST(source);
    const node = ast.children[0];

    if (node.type !== 'LiquidTag') {
      throw new Error('expected LiquidTag');
    }

    expect(node.name).to.eql('#');
    expect(node.markup).to.eql(markup);
    expect(sourceAt(ast.source, node.markupPosition)).to.eql(rawMarkup);
  });

  it('should parse known standalone echo', () => {
    const ast = toLiquidHtmlAST('{% echo "hi" %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('String');
    expectPath(ast, 'children.0.children').to.eql(undefined);
  });

  it('should parse known standalone assign', () => {
    const ast = toLiquidHtmlAST('{% assign x = "hello" %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('assign');
    expectPath(ast, 'children.0.markup.type').to.eql('AssignMarkup');
  });

  it('should parse known standalone render', () => {
    const ast = toLiquidHtmlAST('{% render "snippet" %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('render');
    expectPath(ast, 'children.0.markup.type').to.eql('RenderMarkup');
  });

  it('should fall back to base case for invalid markup (tolerant)', () => {
    const ast = toLiquidHtmlAST('{% assign !bad %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('assign');
    expectPath(ast, 'children.0.markup').to.eql('!bad');
  });

  it('should handle whitespace stripping', () => {
    const ast = toLiquidHtmlAST('{%- echo "hi" -%}');
    expectPath(ast, 'children.0.whitespaceStart').to.eql('-');
    expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
  });

  it('should have correct position for tag node', () => {
    const ast = toLiquidHtmlAST('before{% echo "x" %}after');
    expectPosition(ast, 'children.1').to.eql('{% echo "x" %}');
  });

  it('should produce text before and after a tag', () => {
    const ast = toLiquidHtmlAST('hello {% echo "x" %} world');
    expectPath(ast, 'children').to.have.lengthOf(3);
    expectPath(ast, 'children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.1.type').to.eql('LiquidTag');
    expectPath(ast, 'children.2.type').to.eql('TextNode');
  });

  it('should parse multiple tags', () => {
    const ast = toLiquidHtmlAST('{% echo "a" %}{% assign x = "b" %}');
    expectPath(ast, 'children').to.have.lengthOf(2);
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('echo');
    expectPath(ast, 'children.1.type').to.eql('LiquidTag');
    expectPath(ast, 'children.1.name').to.eql('assign');
  });

  it('should work with toLiquidAST', () => {
    const ast = toLiquidAST('{% echo "x" %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
  });

  it('should have undefined delimiterWhitespace for standalone tags', () => {
    const ast = toLiquidHtmlAST('{% echo "x" %}');
    expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql(undefined);
    expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql(undefined);
  });

  it('should have undefined blockEndPosition for standalone tags', () => {
    const ast = toLiquidHtmlAST('{% echo "x" %}');
    expectPath(ast, 'children.0.blockEndPosition').to.eql(undefined);
  });
});
