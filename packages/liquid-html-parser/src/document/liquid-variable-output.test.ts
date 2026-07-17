import { describe, it } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import { expectPath, expectPosition } from './test-helpers';

describe('Unit: liquid-variable-output', () => {
  it('should fall back to string markup for unparseable content', () => {
    const ast = toLiquidHtmlAST('{{ !-asd }}');
    expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.markup').to.eql('!-asd');
  });

  it('should parse a simple variable', () => {
    const ast = toLiquidHtmlAST('{{ product }}');
    expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('VariableLookup');
    expectPath(ast, 'children.0.markup.expression.name').to.eql('product');
  });

  it('should parse a dotted lookup', () => {
    const ast = toLiquidHtmlAST('{{ product.title }}');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('VariableLookup');
    expectPath(ast, 'children.0.markup.expression.lookups.0.value').to.eql('title');
  });

  it('should parse a string expression', () => {
    const ast = toLiquidHtmlAST('{{ "hello" }}');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('String');
    expectPath(ast, 'children.0.markup.expression.value').to.eql('hello');
  });

  it('should parse a number expression', () => {
    const ast = toLiquidHtmlAST('{{ 42 }}');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('Number');
    expectPath(ast, 'children.0.markup.expression.value').to.eql('42');
  });

  it('should parse a filter', () => {
    const ast = toLiquidHtmlAST('{{ product | upcase }}');
    expectPath(ast, 'children.0.markup.filters').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.filters.0.name').to.eql('upcase');
  });

  it('should parse multiple filters', () => {
    const ast = toLiquidHtmlAST('{{ product | upcase | strip }}');
    expectPath(ast, 'children.0.markup.filters').to.have.lengthOf(2);
  });

  it('should parse a comparison as BooleanExpression', () => {
    const ast = toLiquidHtmlAST('{{ 1 == 1 }}');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('BooleanExpression');
  });

  it('should parse logical expressions', () => {
    const ast = toLiquidHtmlAST('{{ 1 == 1 and 2 == 2 }}');
    expectPath(ast, 'children.0.markup.expression.condition.type').to.eql('LogicalExpression');
  });

  it('should handle whitespace stripping', () => {
    const ast = toLiquidHtmlAST('{{- x -}}');
    expectPath(ast, 'children.0.whitespaceStart').to.eql('-');
    expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
  });

  it('should have correct position for drop node', () => {
    const ast = toLiquidHtmlAST('before{{ x }}after');
    expectPosition(ast, 'children.1').to.eql('{{ x }}');
  });

  it('should produce text before and after a drop', () => {
    const ast = toLiquidHtmlAST('hello {{ x }} world');
    expectPath(ast, 'children').to.have.lengthOf(3);
    expectPath(ast, 'children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.2.type').to.eql('TextNode');
  });

  it('should parse multiple drops', () => {
    const ast = toLiquidHtmlAST('{{ a }}{{ b }}');
    expectPath(ast, 'children').to.have.lengthOf(2);
    expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
  });

  it('should work with toLiquidAST', () => {
    const ast = toLiquidAST('{{ product }}');
    expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
    expectPath(ast, 'children.0.markup.expression.name').to.eql('product');
  });

  it('should parse a range expression', () => {
    const ast = toLiquidHtmlAST('{{ (1..5) }}');
    expectPath(ast, 'children.0.markup.expression.type').to.eql('Range');
  });

  it('should fall back to string markup for empty drop', () => {
    const ast = toLiquidHtmlAST('{{ }}');
    expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.markup').to.eql('');
  });
});
