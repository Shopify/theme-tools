import { describe, it } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import { expectPath, expectPosition } from './test-helpers';

describe('Unit: liquid-variable-output', () => {
  it.each(["{{ 'key' | t:}}", "{{ 'key' | t:  }}", "{{- 'key' | t:\n-}}"])(
    'should parse an empty filter argument list in strict mode: %s',
    (source) => {
      for (const parse of [toLiquidHtmlAST, toLiquidAST]) {
        const ast = parse(source, { mode: 'strict', allowUnclosedDocumentNode: false });
        expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
        expectPath(ast, 'children.0.markup.filters').to.have.lengthOf(1);
        expectPath(ast, 'children.0.markup.filters.0.name').to.eql('t');
        expectPath(ast, 'children.0.markup.filters.0.args').to.eql([]);
        expectPath(ast, 'children.0.markup.rawSource').to.eql("'key' | t:");
        expectPosition(ast, 'children.0.markup.filters.0').to.eql(' | t:');
      }
    },
  );

  it.each([
    "'key' | t: title:",
    "'key' | t: title: | escape",
    "'key' | t: ,",
    "'key' | t: title: product.title,",
    "'key' | t: @",
  ])('should keep malformed filter arguments as string markup: %s', (markup) => {
    for (const parse of [toLiquidHtmlAST, toLiquidAST]) {
      const ast = parse(`{{ ${markup} }}`, {
        mode: 'strict',
        allowUnclosedDocumentNode: false,
      });
      expectPath(ast, 'children.0.markup').to.eql(markup);
    }
  });
});
