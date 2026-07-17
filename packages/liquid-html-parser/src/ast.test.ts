import { expect, it, describe } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST, RawMarkupKinds } from './ast';
import type { LiquidHtmlNode, DocumentNode } from './ast';
import { deepGet } from './utils';

describe('Unit: Stage 2 (AST)', () => {
  let ast: any;

  describe('Unit: toLiquidHtmlAST(text) and toLiquidAST(text)', () => {
    const testCases = [
      {
        expectPath: makeExpectPath('toLiquidHtmlAST(text)'),
        expectPosition: makeExpectPosition('toLiquidHtmlAST(text)'),
        toAST: toLiquidHtmlAST,
      },
      {
        expectPath: makeExpectPath('toLiquidAST(text)'),
        expectPosition: makeExpectPosition('toLiquidAST(text)'),
        toAST: toLiquidAST,
      },
    ];

    describe('Unit: LiquidVariableOutput', () => {
      it('should transform a base case Liquid Drop into a LiquidVariableOutput', () => {
        for (const { toAST, expectPath, expectPosition } of testCases) {
          ast = toAST('{{ !-asd }}');
          expectPath(ast, 'children.0').to.exist;
          expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
          expectPath(ast, 'children.0.markup').to.eql('!-asd');
          expectPosition(ast, 'children.0');
        }
      });

      it('should set LiquidVariable end position to the markup boundary (Bug 7 regression)', () => {
        for (const { toAST, expectPath } of testCases) {
          // For '{{ product.title }}':
          //   {{ = positions 0..1, openToken.end = 2
          //   ' product.title ' = positions 2..17 (rawMarkup)
          //   }} = positions 17..18, closeToken.start = 17
          // LiquidVariable.start = 3 (first char of 'product')
          // LiquidVariable.end = 17 (closeToken.start, the markup boundary)
          ast = toAST('{{ product.title }}');
          expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
          expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.position.start').to.eql(3);
          expectPath(ast, 'children.0.markup.position.end').to.eql(17);
          expectPath(ast, 'children.0.markup.rawSource').to.eql('product.title');

          // With filters: end should still be the markup boundary
          ast = toAST('{{ price | money }}');
          expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.position.start').to.eql(3);
          expectPath(ast, 'children.0.markup.position.end').to.eql(17);
        }
      });

      it('should set rawSource for LiquidVariable inside {% liquid %} blocks (Bug 21 fix)', () => {
        for (const { toAST, expectPath } of testCases) {
          // echo inside {% liquid %} should have correct rawSource
          ast = toAST('{% liquid\n  echo product.title\n%}');
          expectPath(ast, 'children.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.name').to.eql('liquid');
          expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.markup.0.name').to.eql('echo');
          expectPath(ast, 'children.0.markup.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.0.markup.rawSource').to.eql('product.title');

          // echo with filter inside {% liquid %} should have correct rawSource
          ast = toAST('{% liquid\n  echo product.title | upcase\n%}');
          expectPath(ast, 'children.0.markup.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.0.markup.rawSource').to.eql('product.title | upcase');

          // Standalone {{ }} drops should still have rawSource populated
          ast = toAST('{{ product.title }}');
          expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.rawSource').to.eql('product.title');

          // Standalone {% echo %} outside liquid block should still have rawSource populated
          ast = toAST('{% echo product.title %}');
          expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.rawSource').to.eql('product.title');
        }
      });

      it('should populate rawSource for LiquidVariable inside raw tag bodies (Bug 28)', () => {
        for (const { toAST, expectPath } of testCases) {
          // {{ }} inside {% style %} should have correct rawSource
          ast = toAST('{% style %}{{ product.title }}{% endstyle %}');
          expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
          expectPath(ast, 'children.0.name').to.eql('style');
          expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
          expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidVariableOutput');
          expectPath(ast, 'children.0.body.nodes.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.body.nodes.0.markup.rawSource').to.eql('product.title');

          // {{ }} inside {% javascript %} should have correct rawSource
          ast = toAST('{% javascript %}{{ settings.color }}{% endjavascript %}');
          expectPath(ast, 'children.0.body.nodes.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.body.nodes.0.markup.rawSource').to.eql('settings.color');

          // Standalone {{ }} drops should still have rawSource populated
          ast = toAST('{{ product.title }}');
          expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.rawSource').to.eql('product.title');

          // {% echo %} inside {% style %} should have correct rawSource
          ast = toAST('{% style %}{% echo product.title %}{% endstyle %}');
          expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
          expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.body.nodes.0.name').to.eql('echo');
          expectPath(ast, 'children.0.body.nodes.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.body.nodes.0.markup.rawSource').to.eql('product.title');

          // {% assign %} inside {% style %} should have correct rawSource on the value
          ast = toAST('{% style %}{% assign x = product.title %}{% endstyle %}');
          expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
          expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.body.nodes.0.name').to.eql('assign');
          expectPath(ast, 'children.0.body.nodes.0.markup.type').to.eql('AssignMarkup');
          expectPath(ast, 'children.0.body.nodes.0.markup.value.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.body.nodes.0.markup.value.rawSource').to.eql('product.title');

          // Standalone {% echo %} should still have rawSource populated
          ast = toAST('{% echo product.title %}');
          expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.rawSource').to.eql('product.title');
        }
      });

      it('should populate rawSource for {{ }} drops inside HTML <style> bodies (Bug 28)', () => {
        const expectPath = makeExpectPath('toLiquidHtmlAST - HTML <style> rawSource');
        ast = toLiquidHtmlAST('<style>{{ section.id }}</style>');
        expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
        expectPath(ast, 'children.0.name').to.eql('style');
        expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidVariableOutput');
        expectPath(ast, 'children.0.body.nodes.0.markup.type').to.eql('LiquidVariable');
        expectPath(ast, 'children.0.body.nodes.0.markup.rawSource').to.eql('section.id');

        // With filters
        ast = toLiquidHtmlAST(
          "<style>{{ settings.type_body_font | font_face: font_display: 'swap' }}</style>",
        );
        expectPath(ast, 'children.0.body.nodes.0.markup.rawSource').to.eql(
          "settings.type_body_font | font_face: font_display: 'swap'",
        );
      });

      it('should not truncate rawSource with filters inside {% liquid %} blocks (Bug 21 regression)', () => {
        for (const { toAST, expectPath } of testCases) {
          // The previous (Ohm) parser had a bug where rawSource inside {% liquid %}
          // blocks was truncated because locStart applied the block offset but
          // endIdx did not. This caused values like "'home.hero.title' | t" to
          // become "'home.he" (truncated by the offset difference).
          ast = toAST("{% liquid\n  echo 'home.hero.title' | t\n%}");
          expectPath(ast, 'children.0.markup.0.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.0.markup.rawSource').to.eql("'home.hero.title' | t");

          // Multiple lines inside liquid block
          ast = toAST("{% liquid\n  assign x = 'foo'\n  echo x | upcase | append: '.bar'\n%}");
          expectPath(ast, 'children.0.markup.1.markup.type').to.eql('LiquidVariable');
          expectPath(ast, 'children.0.markup.1.markup.rawSource').to.eql(
            "x | upcase | append: '.bar'",
          );
        }
      });

      it('should parse multiline render inside {% liquid %} as a single statement (Bug 44)', () => {
        for (const { toAST, expectPath } of testCases) {
          ast = toAST("{% liquid\n  render 'foo',\n    bar: baz,\n    qux: quux\n%}");
          expectPath(ast, 'children.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.name').to.eql('liquid');
          expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
          expectPath(ast, 'children.0.markup.0.name').to.eql('render');
        }
      });

      it('should set LogicalExpression position.end to the markup boundary (Bug 9 regression)', () => {
        for (const { toAST, expectPath } of testCases) {
          // For '{% if a and b %}':
          //   {% = positions 0..1, openToken.end = 2
          //   ' if a and b ' = positions 2..14
          //   %} = positions 14..15, closeToken.start = 14
          // 'a' at 6, 'b' at 12 (end=13). eosStart = 14 (closeToken.start).
          // LogicalExpression.end extends to eosStart (14), matching original parser.
          ast = toAST('{% if a and b %}{% endif %}');
          expectPath(ast, 'children.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.name').to.eql('if');
          expectPath(ast, 'children.0.markup.type').to.eql('LogicalExpression');
          expectPath(ast, 'children.0.markup.position.start').to.eql(6);
          expectPath(ast, 'children.0.markup.position.end').to.eql(14);

          // Comparison (without logical) keeps tight position at the last token's end.
          // 'x' at 6, '1' at 11 (end=12). Comparison.end = 12, not eosStart(13).
          ast = toAST('{% if x == 1 %}{% endif %}');
          expectPath(ast, 'children.0.markup.type').to.eql('Comparison');
          expectPath(ast, 'children.0.markup.position.start').to.eql(6);
          expectPath(ast, 'children.0.markup.position.end').to.eql(12);
        }
      });

      it('should set nested LogicalExpression right.position.start to include operator keyword (Bug 19 regression)', () => {
        for (const { toAST, expectPath } of testCases) {
          // For '{% if a == 1 and b == 2 or c == 3 %}':
          //   'a' at 6, '1' at 11 (end 12)
          //   'and' at 13
          //   'b' at 17, '2' at 22 (end 23)
          //   'or' at 24
          //   'c' at 27, '3' at 32 (end 33)
          //
          // Structure: LogicalExpression(left=Comparison(a==1), and, right=LogicalExpression(left=Comparison(b==2), or, right=Comparison(c==3)))
          // The nested LogicalExpression (right) should have position.start at 'and' (13), not 'b' (17).
          // The innermost right (Comparison c==3) should NOT include 'or' — only LogicalExpression children get the operator.
          ast = toAST('{% if a == 1 and b == 2 or c == 3 %}{% endif %}');
          expectPath(ast, 'children.0.markup.type').to.eql('LogicalExpression');
          // Outer LogicalExpression starts at 'a' (6)
          expectPath(ast, 'children.0.markup.position.start').to.eql(6);
          // right is a nested LogicalExpression; its start includes the 'and' keyword
          expectPath(ast, 'children.0.markup.right.type').to.eql('LogicalExpression');
          expectPath(ast, 'children.0.markup.right.position.start').to.eql(13);
          // The nested LogicalExpression's left starts at 'b' (17), not at the operator
          expectPath(ast, 'children.0.markup.right.left.type').to.eql('Comparison');
          expectPath(ast, 'children.0.markup.right.left.position.start').to.eql(17);
          // The nested LogicalExpression's right is a Comparison, starts at 'c' (27)
          expectPath(ast, 'children.0.markup.right.right.type').to.eql('Comparison');
          expectPath(ast, 'children.0.markup.right.right.position.start').to.eql(27);

          // Simple two-operand case: right is not a LogicalExpression, so no operator included
          // '{% if a and b %}' — right is VariableLookup, starts at 'b' (12)
          ast = toAST('{% if a and b %}{% endif %}');
          expectPath(ast, 'children.0.markup.type').to.eql('LogicalExpression');
          expectPath(ast, 'children.0.markup.right.type').to.eql('VariableLookup');
          expectPath(ast, 'children.0.markup.right.position.start').to.eql(12);

          // Nested LogicalExpressions extend position.end to eosStart (markup boundary)
          ast = toAST('{% if a == 1 and b == 2 or c == 3 %}{% endif %}');
          const eosStart = 34; // position of '%}' close token start (space before %})
          expectPath(ast, 'children.0.markup.position.end').to.eql(eosStart);
          expectPath(ast, 'children.0.markup.right.position.end').to.eql(eosStart);
        }
      });

      it('should parse comparisons as LiquidVariable > BooleanExpression > Comparison', () => {
        [
          { expression: `1 == 1` },
          { expression: `1 != 1` },
          { expression: `1 > 1` },
          { expression: `1 < 1` },
          { expression: `1 >= 1` },
          { expression: `1 <= 1` },
        ].forEach(({ expression }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('BooleanExpression');
            expectPath(ast, 'children.0.markup.expression.condition.type').to.eql('Comparison');
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse logical operations as LiquidVariable > BooleanExpression > LogicalExpression', () => {
        [
          { expression: `1 == 1 and 2 == 2` },
          { expression: `1 == 1 or 2 == 2` },
          { expression: `1 == 1 and 2 == 2 or 3 == 3` },
          { expression: `1 == 1 and some_variable or 3 == 3` },
          { expression: `some_var and 'raw string'` },
        ].forEach(({ expression }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('BooleanExpression');
            expectPath(ast, 'children.0.markup.expression.condition.type').to.eql(
              'LogicalExpression',
            );
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse strings as LiquidVariable > String', () => {
        [
          { expression: `"string o' string"`, value: `string o' string`, single: false },
          { expression: `'He said: "hi!"'`, value: `He said: "hi!"`, single: true },
        ].forEach(({ expression, value, single }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('String');
            expectPath(ast, 'children.0.markup.expression.value').to.eql(value);
            expectPath(ast, 'children.0.markup.expression.single').to.eql(single);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse numbers as LiquidVariable > Number', () => {
        [
          { expression: `1`, value: '1' },
          { expression: `1.02`, value: '1.02' },
          { expression: `0`, value: '0' },
          { expression: `-0`, value: '-0' },
          { expression: `-0.0`, value: '-0.0' },
        ].forEach(({ expression, value }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('Number');
            expectPath(ast, 'children.0.markup.expression.value').to.eql(value);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse numbers as LiquidVariable > LiquidLiteral', () => {
        [
          { expression: `nil`, value: null },
          { expression: `null`, value: null },
          { expression: `true`, value: true },
          { expression: `blank`, value: '' },
          { expression: `empty`, value: '' },
        ].forEach(({ expression, value }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('LiquidLiteral');
            expectPath(ast, 'children.0.markup.expression.keyword').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.value').to.eql(value);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse ranges as LiquidVariable > Range', () => {
        [
          {
            expression: `(0..5)`,
            start: { value: '0', type: 'Number' },
            end: { value: '5', type: 'Number' },
          },
          {
            expression: `( 0 .. 5 )`,
            start: { value: '0', type: 'Number' },
            end: { value: '5', type: 'Number' },
          },
          {
            expression: `(true..false)`,
            start: { value: true, type: 'LiquidLiteral' },
            end: { value: false, type: 'LiquidLiteral' },
          },
        ].forEach(({ expression, start, end }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('Range');
            expectPath(ast, 'children.0.markup.expression.start.type').to.eql(start.type);
            expectPath(ast, 'children.0.markup.expression.start.value').to.eql(start.value);
            expectPath(ast, 'children.0.markup.expression.end.type').to.eql(end.type);
            expectPath(ast, 'children.0.markup.expression.end.value').to.eql(end.value);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
            expectPosition(ast, 'children.0.markup.expression.start');
            expectPosition(ast, 'children.0.markup.expression.end');
          }
        });
      });

      interface Lookup {
        type: 'VariableLookup';
        lookups: (string | number | Lookup)[];
        name: string | undefined;
      }

      it('should parse variable lookups as LiquidVariable > VariableLookup', () => {
        const v = (name: string, lookups: (string | number | Lookup)[] = []): Lookup => ({
          type: 'VariableLookup',
          name,
          lookups,
        });
        [
          { expression: `x`, name: 'x', lookups: [] },
          { expression: `x.y`, name: 'x', lookups: ['y'] },
          { expression: `x["y"]`, name: 'x', lookups: ['y'] },
          { expression: `x['y']`, name: 'x', lookups: ['y'] },
          { expression: `x[1]`, name: 'x', lookups: [1] },
          { expression: `x.y.z`, name: 'x', lookups: ['y', 'z'] },
          { expression: `x["y"]["z"]`, name: 'x', lookups: ['y', 'z'] },
          { expression: `x["y"].z`, name: 'x', lookups: ['y', 'z'] },
          { expression: `["product"]`, name: null, lookups: ['product'] },
          { expression: `page.about-us`, name: 'page', lookups: ['about-us'] },
          { expression: `["x"].y`, name: null, lookups: ['x', 'y'] },
          { expression: `["x"]["y"]`, name: null, lookups: ['x', 'y'] },
          { expression: `x[y]`, name: 'x', lookups: [v('y')] },
          { expression: `x[y.z]`, name: 'x', lookups: [v('y', ['z'])] },
        ].forEach(({ expression, name, lookups }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('VariableLookup');
            expectPath(ast, 'children.0.markup.expression.name').to.eql(name);

            lookups.forEach((lookup: string | number | Lookup, i: number) => {
              switch (typeof lookup) {
                case 'string': {
                  expectPath(ast, `children.0.markup.expression.lookups.${i}.type`).to.equal(
                    'String',
                  );
                  expectPath(ast, `children.0.markup.expression.lookups.${i}.value`).to.equal(
                    lookup,
                  );
                  break;
                }
                case 'number': {
                  expectPath(ast, `children.0.markup.expression.lookups.${i}.type`).to.equal(
                    'Number',
                  );
                  expectPath(ast, `children.0.markup.expression.lookups.${i}.value`).to.equal(
                    lookup.toString(),
                  );
                  break;
                }
                default: {
                  expectPath(ast, `children.0.markup.expression.lookups.${i}.type`).to.equal(
                    'VariableLookup',
                  );
                  expectPath(ast, `children.0.markup.expression.lookups.${i}.name`).to.equal(
                    lookup.name,
                  );
                  lookup.lookups.forEach((val, j) => {
                    // Being lazy here... Assuming string properties.
                    expectPath(
                      ast,
                      `children.0.markup.expression.lookups.${i}.lookups.${j}.type`,
                    ).to.equal('String');
                    expectPath(
                      ast,
                      `children.0.markup.expression.lookups.${i}.lookups.${j}.value`,
                    ).to.equal(val);
                  });
                  break;
                }
              }
            });

            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse filters', () => {
        interface Filter {
          name: string;
          args: FilterArgument[];
        }
        type FilterArgument = any;

        const filter = (name: string, args: FilterArgument[] = []): Filter => ({ name, args });
        const arg = (type: string, value: string) => ({ type, value });
        const namedArg = (name: string, valueType: string) => ({
          type: 'NamedArgument',
          name,
          valueType,
        });
        [
          { expression: `| filter1`, filters: [filter('filter1')] },
          { expression: `| filter1 | filter2`, filters: [filter('filter1'), filter('filter2')] },
          {
            expression: `| filter1: 'hi', 'there'`,
            filters: [filter('filter1', [arg('String', 'hi'), arg('String', 'there')])],
          },
          {
            expression: `| filter1: key: value, kind: 'string'`,
            filters: [
              filter('filter1', [namedArg('key', 'VariableLookup'), namedArg('kind', 'String')]),
            ],
          },
          {
            expression: `| f1: 'hi', key: (0..1) | f2: key: value, kind: 'string'`,
            filters: [
              filter('f1', [arg('String', 'hi'), namedArg('key', 'Range')]),
              filter('f2', [namedArg('key', 'VariableLookup'), namedArg('kind', 'String')]),
            ],
          },
        ].forEach(({ expression, filters }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{{ 'hello' ${expression} }}`);
            expectPath(ast, 'children.0.type').to.equal('LiquidVariableOutput');
            expectPath(ast, 'children.0.markup.type').to.equal('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.equal(`'hello' ` + expression);
            expectPath(ast, 'children.0.markup.filters').to.have.lengthOf(filters.length);
            filters.forEach((filter, i) => {
              expectPath(ast, `children.0.markup.filters.${i}`).to.exist;
              expectPath(ast, `children.0.markup.filters.${i}.type`).to.equal(
                'LiquidFilter',
                expression,
              );
              expectPath(ast, `children.0.markup.filters.${i}.name`).to.equal(filter.name);
              expectPath(ast, `children.0.markup.filters.${i}.args`).to.exist;
              expectPath(ast, `children.0.markup.filters.${i}.args`).to.have.lengthOf(
                filter.args.length,
              );
              filter.args.forEach((arg: any, j) => {
                expectPath(ast, `children.0.markup.filters.${i}.args`).to.exist;
                switch (arg.type) {
                  case 'String': {
                    expectPath(ast, `children.0.markup.filters.${i}.args.${j}.type`).to.equal(
                      'String',
                    );
                    expectPath(ast, `children.0.markup.filters.${i}.args.${j}.value`).to.equal(
                      arg.value,
                    );
                    break;
                  }
                  case 'NamedArgument': {
                    expectPath(ast, `children.0.markup.filters.${i}.args`).to.not.be.empty;
                    expectPath(ast, `children.0.markup.filters.${i}.args.${j}.type`).to.equal(
                      'NamedArgument',
                    );
                    expectPath(ast, `children.0.markup.filters.${i}.args.${j}.name`).to.equal(
                      arg.name,
                    );
                    expectPath(ast, `children.0.markup.filters.${i}.args.${j}.value.type`).to.equal(
                      arg.valueType,
                    );
                    break;
                  }
                }
              });
            });
            expectPath(ast, 'children.0.whitespaceStart').to.equal('');
            expectPath(ast, 'children.0.whitespaceEnd').to.equal('');
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });
    });

    describe('Case: LiquidTag', () => {
      it('should transform a basic Liquid Tag into a LiquidTag', () => {
        for (const { toAST, expectPath, expectPosition } of testCases) {
          ast = toAST('{% name %}{% if -%}{%- endif %}');
          expectPath(ast, 'children.0').to.exist;
          expectPath(ast, 'children.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.name').to.eql('name');
          expectPath(ast, 'children.0.markup').to.eql('');
          expectPath(ast, 'children.0.children').to.be.undefined;
          expectPath(ast, 'children.1.whitespaceStart').to.eql('');
          expectPath(ast, 'children.1.whitespaceEnd').to.eql('-');
          expectPath(ast, 'children.1.delimiterWhitespaceStart').to.eql('-');
          expectPath(ast, 'children.1.delimiterWhitespaceEnd').to.eql('');
          expectPosition(ast, 'children.0');
        }
      });

      it('should parse echo tags', () => {
        [
          { expression: `"hi"`, expressionType: 'String', expressionValue: 'hi', filters: [] },
          { expression: `x | f`, expressionType: 'VariableLookup', filters: ['f'] },
        ].forEach(({ expression, expressionType, expressionValue, filters }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{% echo ${expression} -%}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidTag');
            expectPath(ast, 'children.0.name').to.eql('echo');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.expression.type').to.eql(expressionType);
            if (expressionValue)
              expectPath(ast, 'children.0.markup.expression.value').to.eql(expressionValue);
            expectPath(ast, 'children.0.markup.filters').to.have.lengthOf(filters.length);
            expectPath(ast, 'children.0.children').to.be.undefined;
            expectPath(ast, 'children.0.whitespaceStart').to.eql('');
            expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
            expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql(undefined);
            expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql(undefined);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
          }
        });
      });

      it('should parse assign tags', () => {
        [
          {
            expression: `x = "hi"`,
            name: 'x',
            expressionType: 'String',
            expressionValue: 'hi',
            filters: [],
          },
          {
            expression: `z = y | f`,
            name: 'z',
            expressionType: 'VariableLookup',
            filters: ['f'],
          },
        ].forEach(({ expression, name, expressionType, expressionValue, filters }) => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{% assign ${expression} -%}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidTag');
            expectPath(ast, 'children.0.name').to.eql('assign');
            expectPath(ast, 'children.0.markup.type').to.eql('AssignMarkup');
            expectPath(ast, 'children.0.markup.name').to.eql(name);
            expectPath(ast, 'children.0.markup.value.expression.type').to.eql(expressionType);
            if (expressionValue)
              expectPath(ast, 'children.0.markup.value.expression.value').to.eql(expressionValue);
            expectPath(ast, 'children.0.markup.value.filters').to.have.lengthOf(filters.length);
            expectPath(ast, 'children.0.children').to.be.undefined;
            expectPath(ast, 'children.0.whitespaceStart').to.eql('');
            expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
            expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql(undefined);
            expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql(undefined);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.value');
            expectPosition(ast, 'children.0.markup.value.expression');
          }
        });
      });

      it('should parse render tags', () => {
        [
          {
            expression: `"snippet"`,
            snippetType: 'String',
            alias: null,
            renderVariableExpression: null,
            namedArguments: [],
          },
          {
            expression: `"snippet" as foo`,
            snippetType: 'String',
            alias: {
              value: 'foo',
            },
            renderVariableExpression: null,
            namedArguments: [],
          },
          {
            expression: `"snippet" with "string" as foo`,
            snippetType: 'String',
            alias: {
              value: 'foo',
            },
            renderVariableExpression: {
              kind: 'with',
              name: {
                type: 'String',
              },
            },
            namedArguments: [],
          },
          {
            expression: `"snippet" for products as product`,
            snippetType: 'String',
            alias: {
              value: 'product',
            },
            renderVariableExpression: {
              kind: 'for',
              name: {
                type: 'VariableLookup',
              },
            },
            namedArguments: [],
          },
          {
            expression: `variable with "string" as foo, key1: val1, key2: "hi"`,
            snippetType: 'VariableLookup',
            alias: {
              value: 'foo',
            },
            renderVariableExpression: {
              kind: 'with',
              name: {
                type: 'String',
              },
            },
            namedArguments: [
              { name: 'key1', valueType: 'VariableLookup' },
              { name: 'key2', valueType: 'String' },
            ],
          },
        ].forEach(
          ({ expression, snippetType, renderVariableExpression, alias, namedArguments }) => {
            for (const { toAST, expectPath, expectPosition } of testCases) {
              ast = toAST(`{% render ${expression} -%}`);
              expectPath(ast, 'children.0.type').to.equal('LiquidTag');
              expectPath(ast, 'children.0.name').to.equal('render');
              expectPath(ast, 'children.0.markup.type').to.equal('RenderMarkup');
              expectPath(ast, 'children.0.markup.snippet.type').to.equal(snippetType);
              if (renderVariableExpression) {
                expectPath(ast, 'children.0.markup.variable.type').to.equal(
                  'RenderVariableExpression',
                );
                expectPath(ast, 'children.0.markup.variable.kind').to.equal(
                  renderVariableExpression.kind,
                );
                expectPath(ast, 'children.0.markup.variable.name.type').to.equal(
                  renderVariableExpression.name.type,
                );
                expectPosition(ast, 'children.0.markup.variable');
                expectPosition(ast, 'children.0.markup.variable.name');
              } else {
                expectPath(ast, 'children.0.markup.variable').to.equal(null);
              }
              expectPath(ast, 'children.0.markup.alias.value').to.equal(alias?.value);
              expectPath(ast, 'children.0.markup.args').to.have.lengthOf(namedArguments.length);
              namedArguments.forEach(({ name, valueType }, i) => {
                expectPath(ast, `children.0.markup.args.${i}.type`).to.equal('NamedArgument');
                expectPath(ast, `children.0.markup.args.${i}.name`).to.equal(name);
                expectPath(ast, `children.0.markup.args.${i}.value.type`).to.equal(valueType);
                expectPosition(ast, `children.0.markup.args.${i}`);
                expectPosition(ast, `children.0.markup.args.${i}.value`);
              });
              expectPath(ast, 'children.0.whitespaceStart').to.equal('');
              expectPath(ast, 'children.0.whitespaceEnd').to.equal('-');
              expectPosition(ast, 'children.0');
              expectPosition(ast, 'children.0.markup');
            }
          },
        );
      });

      it('should parse render tags with named args and no comma (Bug 23 regression)', () => {
        for (const { toAST, expectPath } of testCases) {
          // No comma before named args
          ast = toAST(`{% render 'snippet' section: section %}`);
          expectPath(ast, 'children.0.type').to.equal('LiquidTag');
          expectPath(ast, 'children.0.name').to.equal('render');
          expectPath(ast, 'children.0.markup.type').to.equal('RenderMarkup');
          expectPath(ast, 'children.0.markup.snippet.type').to.equal('String');
          expectPath(ast, 'children.0.markup.args').to.have.lengthOf(1);
          expectPath(ast, 'children.0.markup.args.0.name').to.equal('section');
          expectPath(ast, 'children.0.markup.args.0.value.type').to.equal('VariableLookup');

          // With comma still works
          ast = toAST(`{% render 'snippet', section: section %}`);
          expectPath(ast, 'children.0.markup.args').to.have.lengthOf(1);
          expectPath(ast, 'children.0.markup.args.0.name').to.equal('section');

          // Multiple named args without comma before first
          ast = toAST(`{% render 'snippet' key1: val1, key2: val2 %}`);
          expectPath(ast, 'children.0.markup.args').to.have.lengthOf(2);
          expectPath(ast, 'children.0.markup.args.0.name').to.equal('key1');
          expectPath(ast, 'children.0.markup.args.1.name').to.equal('key2');

          // With 'for' and no comma before named args
          ast = toAST(`{% render 'snippet' for products section: section %}`);
          expectPath(ast, 'children.0.markup.variable.kind').to.equal('for');
          expectPath(ast, 'children.0.markup.args').to.have.lengthOf(1);
          expectPath(ast, 'children.0.markup.args.0.name').to.equal('section');
        }
      });

      it('should parse conditional tags into conditional expressions', () => {
        ['if', 'unless'].forEach((tagName) => {
          [
            {
              expression: 'a',
              markup: {
                type: 'VariableLookup',
              },
            },
            {
              expression: 'a and "string"',
              markup: {
                type: 'LogicalExpression',
                relation: 'and',
                left: { type: 'VariableLookup' },
                right: { type: 'String' },
              },
            },
            {
              expression: 'a and "string" or a<1',
              markup: {
                type: 'LogicalExpression',
                relation: 'and',
                left: { type: 'VariableLookup' },
                right: {
                  type: 'LogicalExpression',
                  relation: 'or',
                  left: { type: 'String' },
                  right: {
                    type: 'Comparison',
                    comparator: '<',
                    left: { type: 'VariableLookup' },
                    right: { type: 'Number' },
                  },
                },
              },
            },
          ].forEach(({ expression, markup }) => {
            for (const { toAST, expectPath, expectPosition } of testCases) {
              ast = toAST(`{% ${tagName} ${expression} -%}{% end${tagName} %}`);
              expectPath(ast, 'children.0.type').to.equal('LiquidTag');
              expectPath(ast, 'children.0.name').to.equal(tagName);
              let cursor: any = markup;
              let prefix = '';
              while (cursor) {
                switch (cursor.type) {
                  case 'LogicalExpression': {
                    expectPath(ast, `children.0.markup${prefix}.type`).to.equal(cursor.type);
                    expectPath(ast, `children.0.markup${prefix}.relation`).to.equal(
                      cursor.relation,
                    );
                    expectPath(ast, `children.0.markup${prefix}.left.type`).to.equal(
                      cursor.left.type,
                    );
                    cursor = cursor.right;
                    prefix = prefix + '.right';
                    break;
                  }
                  case 'Comparison': {
                    expectPath(ast, `children.0.markup${prefix}.type`).to.equal(cursor.type);
                    expectPath(ast, `children.0.markup${prefix}.comparator`).to.equal(
                      cursor.comparator,
                    );
                    expectPath(ast, `children.0.markup${prefix}.left.type`).to.equal(
                      cursor.left.type,
                    );
                    expectPath(ast, `children.0.markup${prefix}.right.type`).to.equal(
                      cursor.right.type,
                    );
                    cursor = cursor.right;
                    prefix = prefix + '.right';
                    break;
                  }
                  default: {
                    expectPath(ast, `children.0.markup${prefix}.type`).to.equal(cursor.type);
                    cursor = null;
                    break;
                  }
                }
              }

              expectPosition(ast, 'children.0');
            }
          });
        });
      });

      describe('Case: content_for', () => {
        it('should parse content_for tags with no arguments', () => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{% content_for "blocks" %}`);
            expectPath(ast, 'children.0.type').to.equal('LiquidTag');
            expectPath(ast, 'children.0.name').to.equal('content_for');
            expectPath(ast, 'children.0.markup.type').to.equal('ContentForMarkup');
            expectPath(ast, 'children.0.markup.contentForType.type').to.equal('String');
            expectPath(ast, 'children.0.markup.contentForType.value').to.equal('blocks');
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
          }
        });

        it('should parse content_for named expression arguments', () => {
          for (const { toAST, expectPath, expectPosition } of testCases) {
            ast = toAST(`{% content_for "snippet", s: 'string', n: 10, r: (1..2), v: variable %}`);
            expectPath(ast, 'children.0.type').to.equal('LiquidTag');
            expectPath(ast, 'children.0.name').to.equal('content_for');
            expectPath(ast, 'children.0.markup.type').to.equal('ContentForMarkup');
            expectPath(ast, 'children.0.markup.contentForType.type').to.equal('String');
            expectPath(ast, 'children.0.markup.contentForType.value').to.equal('snippet');
            expectPath(ast, 'children.0.markup.args').to.have.lengthOf(4);
            expectPath(ast, 'children.0.markup.args.0.type').to.equal('NamedArgument');
            expectPath(ast, 'children.0.markup.args.0.name').to.equal('s');
            expectPath(ast, 'children.0.markup.args.0.value.type').to.equal('String');
            expectPath(ast, 'children.0.markup.args.1.type').to.equal('NamedArgument');
            expectPath(ast, 'children.0.markup.args.1.name').to.equal('n');
            expectPath(ast, 'children.0.markup.args.1.value.type').to.equal('Number');
            expectPath(ast, 'children.0.markup.args.2.type').to.equal('NamedArgument');
            expectPath(ast, 'children.0.markup.args.2.name').to.equal('r');
            expectPath(ast, 'children.0.markup.args.2.value.type').to.equal('Range');
            expectPath(ast, 'children.0.markup.args.3.type').to.equal('NamedArgument');
            expectPath(ast, 'children.0.markup.args.3.name').to.equal('v');
            expectPath(ast, 'children.0.markup.args.3.value.type').to.equal('VariableLookup');
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
          }
        });

        it('should parse content_for with dotted named argument keys', () => {
          for (const { toAST, expectPath } of testCases) {
            ast = toAST(`{% content_for "block", closest.collection: collection %}`);
            expectPath(ast, 'children.0.type').to.equal('LiquidTag');
            expectPath(ast, 'children.0.name').to.equal('content_for');
            expectPath(ast, 'children.0.markup.args').to.have.lengthOf(1);
            expectPath(ast, 'children.0.markup.args.0.type').to.equal('NamedArgument');
            expectPath(ast, 'children.0.markup.args.0.name').to.equal('closest.collection');
            expectPath(ast, 'children.0.markup.args.0.value.type').to.equal('VariableLookup');
          }
        });
      });
    });

    it(`should parse liquid inline comments`, () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST(`{% #%}`);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('#');
        expectPath(ast, 'children.0.markup').to.eql('');

        ast = toAST(`{% #hello world %}`);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('#');
        expectPath(ast, 'children.0.markup').to.eql('hello world');
      }
    });

    it(`should parse liquid case as branches`, () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST(`{% case A %}{% when A %}A{% when "B" %}B{% else    %}C{% endcase %}`);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('case');

        // There's an empty child node between the case and first when. That's OK (?)
        // What if there's whitespace? I think that's a printer problem. If
        // there's freeform text we should somehow catch it.
        expectPath(ast, 'children.0.children.0').to.exist;
        expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.0.name').to.eql(null);

        expectPath(ast, 'children.0.children.1').to.exist;
        expectPath(ast, 'children.0.children.1.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.1.name').to.eql('when');
        expectPath(ast, 'children.0.children.1.markup').to.have.lengthOf(1);
        expectPath(ast, 'children.0.children.1.markup.0.type').to.equal('VariableLookup');
        expectPath(ast, 'children.0.children.1.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.1.children.0.value').to.eql('A');

        expectPath(ast, 'children.0.children.2.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.2.name').to.eql('when');
        expectPath(ast, 'children.0.children.2.markup.0.type').to.equal('String');
        expectPath(ast, 'children.0.children.2.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.2.children.0.value').to.eql('B');

        expectPath(ast, 'children.0.children.3.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.3.name').to.eql('else');
        expectPath(ast, 'children.0.children.3.markup').to.eql('');
        expectPath(ast, 'children.0.children.3.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.3.children.0.value').to.eql('C');
      }
    });

    it(`should parse liquid ifs as branches`, () => {
      for (const { toAST, expectPath } of testCases) {
        const source = `{% if a %}A{% elsif b %}B{% else %}C{% endif %}`;
        ast = toAST(source);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('if');
        expectPath(ast, 'children.0.children.0').to.exist;
        expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.0.name').to.eql(null);
        expectPath(ast, 'children.0.children.0.markup').to.eql('');
        expectPath(ast, 'children.0.children.0.position.start').to.eql(source.indexOf('A'));
        expectPath(ast, 'children.0.children.0.position.end').to.eql(source.indexOf('A') + 1);
        expectPath(ast, 'children.0.children.0.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.0.children.0.value').to.eql('A');

        expectPath(ast, 'children.0.children.1.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.1.name').to.eql('elsif');
        expectPath(ast, 'children.0.children.1.markup.type').to.eql('VariableLookup');
        expectPath(ast, 'children.0.children.1.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.1.children.0.value').to.eql('B');

        expectPath(ast, 'children.0.children.2.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.2.name').to.eql('else');
        expectPath(ast, 'children.0.children.2.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.2.children.0.value').to.eql('C');
      }
    });

    it('should parse ifchanged as a block tag with no markup and children', () => {
      for (const { toAST, expectPath, expectPosition } of testCases) {
        ast = toAST('{% ifchanged %}hello{% endifchanged %}');
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('ifchanged');
        expectPath(ast, 'children.0.markup').to.eql(null);
        expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.0.value').to.eql('hello');
        expectPosition(ast, 'children.0');
      }
    });

    it('should parse partial as a block tag with string markup', () => {
      for (const { toAST, expectPath, expectPosition } of testCases) {
        ast = toAST(`{% partial 'header' %}content{% endpartial %}`);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('partial');
        expectPath(ast, 'children.0.markup.type').to.eql('String');
        expectPath(ast, 'children.0.markup.value').to.eql('header');
        expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.0.value').to.eql('content');
        expectPosition(ast, 'children.0');
        expectPosition(ast, 'children.0.markup');
      }
    });

    it('should parse block as a block tag with name and children', () => {
      for (const { toAST, expectPath, expectPosition } of testCases) {
        ast = toAST(`{% block 'foo' %}content{% endblock %}`);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('block');
        expectPath(ast, 'children.0.markup.type').to.eql('BlockMarkup');
        expectPath(ast, 'children.0.markup.name.type').to.eql('String');
        expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
        expectPath(ast, 'children.0.markup.args').to.eql([]);
        expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.0.value').to.eql('content');
        expectPosition(ast, 'children.0');
        expectPosition(ast, 'children.0.markup');
      }
    });

    it('should include trailing whitespace in block markup position (Bug 29 fix)', () => {
      for (const { toAST, expectPosition } of testCases) {
        ast = toAST(`{% block 'name' %}{% endblock %}`);
        expectPosition(ast, 'children.0.markup').to.eql(`'name' `);

        ast = toAST(`{% block 'name', key: 'val' %}{% endblock %}`);
        expectPosition(ast, 'children.0.markup').to.eql(`'name', key: 'val' `);
      }
    });

    it('should parse block with kwargs', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST(`{% block 'foo', key: 'val' %}content{% endblock %}`);
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('block');
        expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
        expectPath(ast, 'children.0.markup.args.0.type').to.eql('NamedArgument');
        expectPath(ast, 'children.0.markup.args.0.name').to.eql('key');
        expectPath(ast, 'children.0.markup.args.0.value.value').to.eql('val');
        expectPath(ast, 'children.0.children.0.value').to.eql('content');
      }
    });

    it('should parse section self-closing (existing behavior preserved)', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST(`{% section 'foo' %}`);
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('section');
        expectPath(ast, 'children.0.markup.type').to.eql('SectionMarkup');
        expectPath(ast, 'children.0.markup.name.type').to.eql('String');
        expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
        expectPath(ast, 'children.0.markup.args').to.eql([]);
        expectPath(ast, 'children.0.children').to.be.undefined;
      }
    });

    it('should parse section self-closing with kwargs', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST(`{% section 'foo', key: 'val' %}`);
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('section');
        expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
        expectPath(ast, 'children.0.markup.args.0.type').to.eql('NamedArgument');
        expectPath(ast, 'children.0.markup.args.0.name').to.eql('key');
        expectPath(ast, 'children.0.markup.args.0.value.value').to.eql('val');
      }
    });

    it('should parse section hybrid (block form) with endsection', () => {
      for (const { toAST, expectPath } of testCases) {
        const source = `{% section 'foo' %}content{% endsection %}`;
        ast = toAST(source);
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('section');
        expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
        expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.children.0.value').to.eql('content');

        // blockEndPosition should span the {% endsection %} tag exactly
        expectPath(ast, 'children.0.blockEndPosition.start').to.eql(
          source.indexOf('{% endsection %}'),
        );
        expectPath(ast, 'children.0.blockEndPosition.end').to.eql(source.length);

        // section node position.end should match endsection's end
        expectPath(ast, 'children.0.position.end').to.eql(source.length);

        expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('');
        expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('');
      }
    });

    it('should capture whitespace trimming on endsection', () => {
      for (const { toAST, expectPath } of testCases) {
        const source = `{% section 'foo' %}content{%- endsection -%}`;
        ast = toAST(source);
        expectPath(ast, 'children.0.name').to.eql('section');
        expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('-');
        expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
        expectPath(ast, 'children.0.blockEndPosition.start').to.eql(
          source.indexOf('{%- endsection -%}'),
        );
        expectPath(ast, 'children.0.blockEndPosition.end').to.eql(source.length);
        expectPath(ast, 'children.0.position.end').to.eql(source.length);
      }
    });

    it('should throw on orphaned endsection', () => {
      for (const { toAST } of testCases) {
        expect(() => {
          toAST(`{% endsection %}`);
        }).to.throw(/without a matching/);
      }
    });

    it('should correctly report the position of branches', () => {
      for (const { toAST, expectPath } of testCases) {
        const branchA = ' <div>A</div> ';
        const branchB = ' <span>B</span> ';
        const branchC = ' {% if C %}{% endif %} ';
        const source = `{% if a %}${branchA}{% elsif b %}${branchB}{% else %}${branchC}{% endif %}`;
        ast = toAST(source);

        expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.0.position.start').to.equal(source.indexOf(branchA));
        expectPath(ast, 'children.0.children.0.position.end').to.equal(
          source.indexOf(branchA) + branchA.length,
        );
        expectPath(ast, 'children.0.children.0.blockStartPosition.start').to.equal(
          source.indexOf(branchA),
        );
        expectPath(ast, 'children.0.children.0.blockStartPosition.end').to.equal(
          source.indexOf(branchA),
        );
        expectPath(ast, 'children.0.children.0.blockEndPosition.start').to.equal(
          source.indexOf('{% elsif b %}'),
        );
        expectPath(ast, 'children.0.children.0.blockEndPosition.end').to.equal(
          source.indexOf('{% elsif b %}'),
        );

        expectPath(ast, 'children.0.children.1.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.1.position.start').to.equal(
          source.indexOf('{% elsif b %}' + branchB),
        );
        expectPath(ast, 'children.0.children.1.position.end').to.equal(
          source.indexOf(branchB) + branchB.length,
        );
        expectPath(ast, 'children.0.children.1.blockStartPosition.start').to.equal(
          source.indexOf('{% elsif b %}'),
        );
        expectPath(ast, 'children.0.children.1.blockStartPosition.end').to.equal(
          source.indexOf('{% elsif b %}') + '{% elsif b %}'.length,
        );
        expectPath(ast, 'children.0.children.1.blockEndPosition.start').to.equal(
          source.indexOf('{% else %}'),
        );
        expectPath(ast, 'children.0.children.1.blockEndPosition.end').to.equal(
          source.indexOf('{% else %}'),
        );

        expectPath(ast, 'children.0.children.2.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.2.position.start').to.equal(
          source.indexOf('{% else %}' + branchC),
        );
        expectPath(ast, 'children.0.children.2.position.end').to.equal(
          source.indexOf(branchC) + branchC.length,
        );
        expectPath(ast, 'children.0.children.2.blockStartPosition.start').to.equal(
          source.indexOf('{% else %}'),
        );
        expectPath(ast, 'children.0.children.2.blockStartPosition.end').to.equal(
          source.indexOf('{% else %}') + '{% else %}'.length,
        );
        expectPath(ast, 'children.0.children.2.blockEndPosition.start').to.equal(
          source.indexOf('{% endif %}', source.indexOf(branchC) + branchC.length),
        );
        expectPath(ast, 'children.0.children.2.blockEndPosition.end').to.equal(
          source.indexOf('{% endif %}', source.indexOf(branchC) + branchC.length),
        );
      }
    });

    it('should parse raw-like tags', () => {
      const tags = ['javascript', 'style'];
      for (const { toAST, expectPath, expectPosition } of testCases) {
        for (const tag of tags) {
          const code = `
            {% ${tag} %}
              {% liquid
                assign x = 1
                assign x = 2
              %}
              /* comment string */
            {% end${tag} %}
          `;
          ast = toAST(code);
          expectPath(ast, 'children.0').to.exist;
          expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
          expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
          expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.body.nodes.0.markup.0.name').to.eql('assign');
          expectPath(ast, 'children.0.body.nodes.0.markup.1.name').to.eql('assign');
          expectPath(ast, 'children.0.body.nodes.1.type').to.eql('TextNode');
          expectPosition(ast, 'children.0.body.nodes.0.markup.0').toEqual('assign x = 1');
          expectPosition(ast, 'children.0.body.nodes.0.markup.1').toEqual('assign x = 2');
          expectPosition(ast, 'children.0.body.nodes.1').toEqual('/* comment string */');
        }
      }
    });

    it('should parse schema tag body as a TextNode (Bug 10 regression)', () => {
      for (const { toAST, expectPath, expectPosition } of testCases) {
        ast = toAST('{% schema %}{"name":"test"}{% endschema %}');
        expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
        expectPath(ast, 'children.0.name').to.eql('schema');
        expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
        expectPath(ast, 'children.0.body.kind').to.eql('json');
        expectPath(ast, 'children.0.body.value').to.eql('{"name":"test"}');
        expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(1);
        expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.body.nodes.0.value').to.eql('{"name":"test"}');
        expectPosition(ast, 'children.0.body.nodes.0').toEqual('{"name":"test"}');
      }
    });

    it('should parse schema tag body with surrounding whitespace (Bug 10 regression)', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST('{% schema %}\n  {"name":"test"}\n{% endschema %}');
        expectPath(ast, 'children.0.body.value').to.eql('\n  {"name":"test"}\n');
        expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(1);
        expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.body.nodes.0.value').to.eql('{"name":"test"}');
      }
    });

    it('should parse empty schema tag body as empty nodes (Bug 10 regression)', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST('{% schema %}{% endschema %}');
        expectPath(ast, 'children.0.body.value').to.eql('');
        expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(0);
      }
    });

    it('should assign kind=css for {% style %} tags without Liquid (Bug 13+42 regression)', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST('{% style %}.foo { color: red }{% endstyle %}');
        expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
        expectPath(ast, 'children.0.name').to.eql('style');
        expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.css);
      }
    });

    it('should assign kind=css for HTML <style> elements (Bug 13 regression)', () => {
      ast = toLiquidHtmlAST('<style>.foo { color: red }</style>');
      expect(deepGet('children.0.type'.split('.'), ast)).to.eql('HtmlRawNode');
      expect(deepGet('children.0.name'.split('.'), ast)).to.eql('style');
      expect(deepGet('children.0.body.kind'.split('.'), ast)).to.eql(RawMarkupKinds.css);
    });

    it('should assign kind=text for HTML <style> with Liquid content (Bug 42 regression)', () => {
      ast = toLiquidHtmlAST('<style>.foo { color: {{ color }} }</style>');
      expect(deepGet('children.0.type'.split('.'), ast)).to.eql('HtmlRawNode');
      expect(deepGet('children.0.name'.split('.'), ast)).to.eql('style');
      expect(deepGet('children.0.body.kind'.split('.'), ast)).to.eql(RawMarkupKinds.text);
    });

    it('should assign kind=text for HTML <style> with Liquid tag (Bug 42 regression)', () => {
      ast = toLiquidHtmlAST('<style>{% if true %}.foo { }{% endif %}</style>');
      expect(deepGet('children.0.type'.split('.'), ast)).to.eql('HtmlRawNode');
      expect(deepGet('children.0.name'.split('.'), ast)).to.eql('style');
      expect(deepGet('children.0.body.kind'.split('.'), ast)).to.eql(RawMarkupKinds.text);
    });

    it('should assign kind=css for {% style %} without Liquid content (Bug 42 regression)', () => {
      ast = toLiquidHtmlAST('{% style %}.foo { color: red }{% endstyle %}');
      expect(deepGet('children.0.type'.split('.'), ast)).to.eql('LiquidRawTag');
      expect(deepGet('children.0.name'.split('.'), ast)).to.eql('style');
      expect(deepGet('children.0.body.kind'.split('.'), ast)).to.eql(RawMarkupKinds.css);
    });

    it('should assign kind=text for {% style %} with Liquid content (Bug 42 regression)', () => {
      ast = toLiquidHtmlAST('{% style %}.foo { color: {{ color }} }{% endstyle %}');
      expect(deepGet('children.0.type'.split('.'), ast)).to.eql('LiquidRawTag');
      expect(deepGet('children.0.name'.split('.'), ast)).to.eql('style');
      expect(deepGet('children.0.body.kind'.split('.'), ast)).to.eql(RawMarkupKinds.text);
    });

    it('should parse <use> inside SVG raw body with Liquid blocks as TextNode, not HtmlElement (Bug 46)', () => {
      const expectPath = makeExpectPath('toLiquidHtmlAST - SVG use Bug 46');
      ast = toLiquidHtmlAST('<svg>{% if true %}<use href="#icon" />{% endif %}</svg>');
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('svg');
      // The {% if %} block inside SVG raw body should have TextNode children,
      // not HtmlElement — SVG raw bodies disable HTML parsing.
      const ifTag = deepGet('children.0.body.nodes.0'.split('.'), ast);
      expect(ifTag.type).to.eql('LiquidTag');
      expect(ifTag.name).to.eql('if');
      const branch = ifTag.children[0];
      expect(branch.type).to.eql('LiquidBranch');
      // The <use> tag should be a TextNode, not an HtmlElement
      const useChild = branch.children.find(
        (c: any) => c.type !== 'TextNode' || c.value.includes('<use'),
      );
      expect(useChild).to.exist;
      expect(useChild.type).to.eql('TextNode');
    });

    it('should depth-balance nested same-name raw tags and close at the outer tag (issue 156)', () => {
      const expectPath = makeExpectPath('toLiquidHtmlAST - nested raw close balancing');

      // Nested <svg> elements: the outer <svg> must close at the LAST
      // </svg>, keeping the inner <svg>…</svg> as raw body text rather than
      // closing early at the first </svg> (which previously threw / mis-parsed).
      ast = toLiquidHtmlAST('<svg>a<svg>b</svg>c</svg>');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('svg');
      expectPath(ast, 'children.0.body.value').to.eql('a<svg>b</svg>c');

      // Same balancing for a non-svg raw tag (<script>).
      ast = toLiquidHtmlAST('<script>a<script>b</script>c</script>');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('script');
      expectPath(ast, 'children.0.body.value').to.eql('a<script>b</script>c');
    });

    it(`should parse a basic text node into a TextNode`, () => {
      for (const { toAST, expectPath, expectPosition } of testCases) {
        ast = toAST('Hello world!');
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.value').to.eql('Hello world!');
        expectPosition(ast, 'children.0');
      }
    });
  });

  describe('Unit: toLiquidHtmlAST(text)', () => {
    let ast: any;
    let expectPath = makeExpectPath('toLiquidHtmlAST');
    let expectPosition = makeExpectPosition('toLiquidHtmlAST');

    it('should parse HTML attributes', () => {
      ast = toLiquidHtmlAST(`<img src="https://1234" loading='lazy' disabled checked="">`);
      expectPath(ast, 'children.0').to.exist;
      expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
      expectPath(ast, 'children.0.name').to.eql('img');
      expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('src');
      expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql('https://1234');
      expectPath(ast, 'children.0.attributes.1.name.0.value').to.eql('loading');
      expectPath(ast, 'children.0.attributes.1.value.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.attributes.1.value.0.value').to.eql('lazy');
      expectPath(ast, 'children.0.attributes.2.name.0.value').to.eql('disabled');
      expectPath(ast, 'children.0.attributes.3.name.0.value').to.eql('checked');
      expectPath(ast, 'children.0.attributes.3.value.0').to.be.undefined;

      expectPosition(ast, 'children.0');
      expectPosition(ast, 'children.0.attributes.0');
      expectPosition(ast, 'children.0.attributes.0.value.0');
      expectPosition(ast, 'children.0.attributes.1');
      expectPosition(ast, 'children.0.attributes.1.value.0');
      expectPosition(ast, 'children.0.attributes.2');
    });

    it('should parse HTML attributes inside tags', () => {
      ast = toLiquidHtmlAST(
        `<img {% if cond %}src="https://1234" loading='lazy'{% else %}disabled{% endif %}>`,
      );
      expectPath(ast, 'children.0').to.exist;
      expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
      expectPath(ast, 'children.0.name').to.eql('img');
      expectPath(ast, 'children.0.attributes.0.name').to.eql('if');
      expectPath(ast, 'children.0.attributes.0.children.0.type').to.eql('LiquidBranch');
      expectPath(ast, 'children.0.attributes.0.children.0.children.0.type').to.eql(
        'AttrDoubleQuoted',
      );
      expectPath(ast, 'children.0.attributes.0.children.0.children.1.type').to.eql(
        'AttrSingleQuoted',
      );
    });

    it('should preserve whitespace in LiquidBranch children inside attribute values', () => {
      ast = toLiquidHtmlAST(`<div class="base{% if x %} extra-class{% endif %}"></div>`);
      // The LiquidTag (if) is inside the attribute value
      const ifTag = 'children.0.attributes.0.value.1';
      expectPath(ast, `${ifTag}.type`).to.eql('LiquidTag');
      expectPath(ast, `${ifTag}.name`).to.eql('if');
      // The branch child TextNode must preserve its leading space
      const branchChild = `${ifTag}.children.0.children.0`;
      expectPath(ast, `${branchChild}.type`).to.eql('TextNode');
      expectPath(ast, `${branchChild}.value`).to.eql(' extra-class');
    });

    it('should parse HTML tags with Liquid Drop names', () => {
      [
        `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{node_type}}>`,
        `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{ node_type }}>`,
        `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{- node_type }}>`,
        `<{{ node_type }} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
        `<{{ node_type -}} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
        `<{{ node_type -}} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
        `<{{- node_type -}} src="https://1234" loading='lazy' disabled></{{- node_type -}}>`,
      ].forEach((testCase) => {
        ast = toLiquidHtmlAST(testCase);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('HtmlElement');
        expectPath(ast, 'children.0.name.0.type').to.eql('LiquidVariableOutput');
        expectPath(ast, 'children.0.name.0.markup.type').to.eql('LiquidVariable');
        expectPath(ast, 'children.0.name.0.markup.rawSource').to.eql('node_type');
        expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('src');
        expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql('https://1234');
        expectPath(ast, 'children.0.attributes.1.name.0.value').to.eql('loading');
        expectPath(ast, 'children.0.attributes.1.value.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.attributes.1.value.0.value').to.eql('lazy');
        expectPath(ast, 'children.0.attributes.2.name.0.value').to.eql('disabled');
      });
    });

    it('should parse HTML tags with compound Liquid Drop names', () => {
      ast = toLiquidHtmlAST(`<{{ node_type }}--header ></{{node_type}}--header>`);
      expectPath(ast, 'children.0').to.exist;
      expectPath(ast, 'children.0.type').to.eql('HtmlElement');
      expectPath(ast, 'children.0.name.0.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.name.0.markup.type').to.eql('LiquidVariable');
      expectPath(ast, 'children.0.name.0.markup.rawSource').to.eql('node_type');
      expectPath(ast, 'children.0.name.1.value').to.eql('--header');
    });

    it('should parse HTML self-closing elements with compound Liquid Drop names', () => {
      ast = toLiquidHtmlAST(`<{{ node_type }}--header />`);
      expectPath(ast, 'children.0').to.exist;
      expectPath(ast, 'children.0.type').to.eql('HtmlSelfClosingElement');
      expectPath(ast, 'children.0.name.0.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.name.0.markup.type').to.eql('LiquidVariable');
      expectPath(ast, 'children.0.name.0.markup.rawSource').to.eql('node_type');
      expectPath(ast, 'children.0.name.1.value').to.eql('--header');
    });

    it('should allow unclosed nodes inside conditional and case branches', () => {
      let testCases = [
        // one unclosed
        '{% if cond %}<div>{% endif %}',
        '{% if cond %}{% else %}<div>{% endif %}',
        '{% if cond %}<div>{% else %}{% endif %}',
        '{% if cond %}{% elsif cond %}<div>{% endif %}',
        // two unclosed
        '{% if cond %}<div><a>{% endif %}',
        '{% if cond %}{% else %}<div><a>{% endif %}',
        '{% if cond %}{% elsif cond %}<div><a>{% endif %}',
        '{% case cond %}{% when %}<div><a>{% endcase %}',
        // three unclosed
        '{% if cond %}<a><b><c>{% endif %}',
        '{% if cond %}{% else %}<a><b><c>{% endif %}',
        '{% if cond %}{% elsif cond %}<a><b><c>{% endif %}',
        '{% case cond %}{% when %}<a><b><c>{% endcase %}',
        // 1 closed, last unclosed
        '{% if cond %}<a>hi</a><b>{% endif %}',
        // last unclosed with closed child
        '{% if cond %}<b><a>hi</a>{% endif %}',
        '{% if cond %}{% else %}<a>hi</a><b>{% endif %}',
        '{% if cond %}{% else %}<b><a>hi</a>{% endif %}',
        '{% if cond %}{% elsif cond %}<a>hi</a><b>{% endif %}',
        '{% if cond %}{% elsif cond %}<b><a>hi</a>{% endif %}',
        '{% case cond %}{% when %}<a>hi</a><b>{% endcase %}',
      ];
      for (const testCase of testCases) {
        expect(() => toLiquidHtmlAST(testCase), testCase).not.to.throw();
      }
    });

    describe('Case: unclosed HTML nodes', () => {
      it('should let me write unclosed nodes inside if statements', () => {
        const unclosedDetailsSummary = '<details><summary>hello</summary>';
        const testCases = [
          {
            testCase: `{% if cond %}${unclosedDetailsSummary}{% endif %}`,
            detailsNodePath: 'children.0.children.0.children.0',
          },
          {
            testCase: `{% if cond %}${unclosedDetailsSummary}{% else %}{% endif %}`,
            detailsNodePath: 'children.0.children.0.children.0',
          },
          {
            testCase: `{% if cond %}{% elsif other_cond %}${unclosedDetailsSummary}{% endif %}`,
            detailsNodePath: 'children.0.children.1.children.0',
          },
          {
            testCase: `{% if cond %}{% elsif other_cond %}{% else %}${unclosedDetailsSummary}{% endif %}`,
            detailsNodePath: 'children.0.children.2.children.0',
            extraExpectations: (ast: DocumentNode) => {
              expectPosition(ast, 'children.0.children.0').toEqual('');
              expectPosition(ast, 'children.0.children.1').toEqual('{% elsif other_cond %}');
              expectPosition(ast, 'children.0.children.2').toEqual(
                `{% else %}${unclosedDetailsSummary}`,
              );
            },
          },
          {
            testCase: `{% unless cond %}${unclosedDetailsSummary}{% endunless %}`,
            detailsNodePath: 'children.0.children.0.children.0',
          },
          {
            testCase: `{% case thing %}{% when cond %}${unclosedDetailsSummary}{% endcase %}`,
            detailsNodePath: 'children.0.children.1.children.0',
          },
          {
            testCase: `{% case thing %}{% when cond %}${unclosedDetailsSummary}{% else %}{% endcase %}`,
            detailsNodePath: 'children.0.children.1.children.0',
          },
          {
            testCase: `{% case thing %}{% else %}${unclosedDetailsSummary}{% endcase %}`,
            detailsNodePath: 'children.0.children.1.children.0',
          },
        ];
        for (const { testCase, detailsNodePath, extraExpectations } of testCases) {
          const ast = toLiquidHtmlAST(testCase, {
            allowUnclosedDocumentNode: false,
            mode: 'tolerant',
          });
          expectPath(ast, 'children.0.type').to.eql('LiquidTag');
          expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
          expectPosition(ast, `${detailsNodePath}`).toEqual('<details><summary>hello</summary>');

          // Does not have a close tag so the slice of the end tag is empty string
          expectPosition(ast, `${detailsNodePath}`, 'blockEndPosition').toEqual('');

          // making sure blockEndPosition isn't -1, -1 but adjusted to the child position
          expect(
            deepGet<number>(`${detailsNodePath}.blockEndPosition.start`.split('.'), ast),
          ).toBeGreaterThan(
            deepGet<number>(`${detailsNodePath}.blockStartPosition.end`.split('.'), ast),
          );

          expectPosition(ast, `${detailsNodePath}.children.0`).toEqual('<summary>hello</summary>');
          expectPosition(ast, `${detailsNodePath}.children.0`, 'blockEndPosition').toEqual(
            '</summary>',
          );
          if (extraExpectations) extraExpectations(ast);
        }
      });

      it('should throw an error when writing an unclosed node inside any other tag', async () => {
        const testCases = [
          '{% for x in y %}<details>{% endfor %}',
          '{% tablerow x in y %}<details>{% endtablerow %}',
          '{% form "cart", cart %}<details>{% endform %}',
        ];
        for (const testCase of testCases) {
          try {
            toLiquidHtmlAST(testCase, {
              allowUnclosedDocumentNode: false,
              mode: 'tolerant',
            });
            expect(true, `expected ${testCase} to throw LiquidHTMLASTParsingError`).to.be.false;
          } catch (e: any) {
            expect(e.name, testCase).to.eql('LiquidHTMLParsingError');
            expect(e.message, testCase).to.match(
              /Attempting to close \w+ '[^']+' before \w+ '[^']+' was closed/,
            );
            expect(e.message).not.to.match(/undefined/i);
            expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
          }
        }
      });
    });

    it('should throw when trying to close the wrong node', () => {
      const testCases = [
        '<a><div></a>',
        '{% for a in b %}<div>{% endfor %}',
        '{% for a in b %}{% if condition %}{% endfor %}',
        '{% for a in b %}{% if condition %}<div>{% endfor %}',
        '<{{ node_type }}><div></{{ node_type }}>',
        '<{{ node_type }}></{{ wrong_end_node }}>',
      ];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.message, testCase).to.match(
            /Attempting to (open|close) \w+ '[^']+' before \w+ '[^']+' was closed/,
          );
          expect(e.message).not.to.match(/undefined/i);
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should throw when doing weird shit', () => {
      const testCases = ['{% if cond %}<a href="{% elsif cond %}">{% endif %}'];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.message).not.to.match(/undefined/i);
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should throw when trying to open a new branch when a Liquid node was not closed', () => {
      const testCases = [
        '{% if cond %}{% form "cart", cart %}{% else %}{% endif %}',
        '{% if cond %}{% form "cart", cart %}{% elsif cond %}{% endif %}',
      ];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.message, testCase).to.match(
            /Attempting to open \w+ '[^']+' before \w+ '[^']+' was closed/,
          );
          expect(e.message).not.to.match(/undefined/i);
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should throw when closing at the top level', () => {
      const testCases = ['<a>', '{% if %}'];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLASTParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.message).to.match(/Attempting to end parsing before \w+ '[^']+' was closed/);
          expect(e.message).not.to.match(/undefined/i);
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should throw when forgetting to close', () => {
      const testCases = ['</a>', '{% endif %}'];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLASTParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.message).to.match(/Attempting to close \w+ '[^']+' before it was opened/);
          expect(e.message).not.to.match(/undefined/i);
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should throw when trying to end doc with unclosed nodes', () => {
      const testCases = ['<p><div>', '{% if condition %}', '<script>', '<{{ node_type }}>'];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLASTParsingError`).to.be.false;
        } catch (e: any) {
          if (e.name === 'AssertionError') {
            console.log(e);
          }
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should parse html comments as raw', () => {
      ast = toLiquidHtmlAST(`<!--\n  hello {{ product.name }}\n-->`);
      expectPath(ast, 'children.0.type').to.eql('HtmlComment');
      expectPath(ast, 'children.0.body').to.eql('hello {{ product.name }}');
      expectPosition(ast, 'children.0');
    });

    it('should parse script tags as raw', () => {
      ast = toLiquidHtmlAST(`<script>\n  const a = {{ product | json }};\n</script>`);
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('script');
      expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
      expectPath(ast, 'children.0.body.kind').to.eql('javascript');
      expectPath(ast, 'children.0.body.value').to.eql('\n  const a = {{ product | json }};\n');
      expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(3);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('TextNode');
      expectPosition(ast, 'children.0.body.nodes.0').toEqual('const a =');
      expectPosition(ast, 'children.0.body.nodes.1').toEqual('{{ product | json }}');
      expectPosition(ast, 'children.0.body.nodes.2').toEqual(';');
      expectPosition(ast, 'children.0');
    });

    it('should detect json kind for script type="application/ld+json"', () => {
      ast = toLiquidHtmlAST(`<script type="application/ld+json">{"@type": "Product"}</script>`);
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('script');
      expectPath(ast, 'children.0.body.kind').to.eql('json');
    });

    it('should detect json kind for script type="application/json"', () => {
      ast = toLiquidHtmlAST(`<script type="application/json">{"key": "value"}</script>`);
      expectPath(ast, 'children.0.body.kind').to.eql('json');
    });

    it('should detect json kind for script type="importmap"', () => {
      ast = toLiquidHtmlAST(`<script type="importmap">{"imports": {}}</script>`);
      expectPath(ast, 'children.0.body.kind').to.eql('json');
    });

    it('should detect json kind for script type="speculationrules"', () => {
      ast = toLiquidHtmlAST(`<script type="speculationrules">{"prerender": []}</script>`);
      expectPath(ast, 'children.0.body.kind').to.eql('json');
    });

    it('should detect javascript kind for script with no type attribute', () => {
      ast = toLiquidHtmlAST(`<script>var x = 1;</script>`);
      expectPath(ast, 'children.0.body.kind').to.eql('javascript');
    });

    it('should parse style tags as raw markup', () => {
      ast = toLiquidHtmlAST(`<style>\n  :root { --bg: {{ settings.bg }}}\n</style>`);
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('style');
      expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
      expectPath(ast, 'children.0.body.kind').to.eql('text');
      expectPath(ast, 'children.0.body.value').to.eql('\n  :root { --bg: {{ settings.bg }}}\n');
      expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(3);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('TextNode');
      expectPosition(ast, 'children.0.body.nodes.0').toEqual(':root { --bg:');
      expectPosition(ast, 'children.0.body.nodes.1').toEqual('{{ settings.bg }}');
      expectPosition(ast, 'children.0.body.nodes.2').toEqual('}');
      expectPosition(ast, 'children.0');
    });
  });

  describe('Unit: toLiquidAST(text)', () => {
    let ast: any;
    let expectPath = makeExpectPath('toLiquidAST');

    it('should parse nested unclosed tags', () => {
      ast = toLiquidAST('{% for a in b %} <div> {% if true %}');

      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('for');

      expectPath(ast, 'children.0.children.0.children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.children.0.value').to.eql('<div>');

      expectPath(ast, 'children.0.children.0.children.1.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.children.0.children.1.name').to.eql('if');
    });

    it('should parse unclosed conditions with assignments', () => {
      ast = toLiquidAST(`
        {%- liquid
          assign var1 = product

          if use_variant
            assign var2 = var1
            assign var3 = var2
        -%}
      `);

      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('liquid');

      expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.markup.0.name').to.eql('assign');
      expectPath(ast, 'children.0.markup.0.markup.name').to.eql('var1');

      expectPath(ast, 'children.0.markup.1.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.markup.1.name').to.eql('if');

      expectPath(ast, 'children.0.markup.1.children.0.children.0.name').to.eql('assign');
      expectPath(ast, 'children.0.markup.1.children.0.children.0.markup.name').to.eql('var2');

      expectPath(ast, 'children.0.markup.1.children.0.children.1.name').to.eql('assign');
      expectPath(ast, 'children.0.markup.1.children.0.children.1.markup.name').to.eql('var3');
    });

    it(`should parse doc tags`, () => {
      ast = toLiquidAST(`{% doc %}{% enddoc %}`);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
      expectPath(ast, 'children.0.markup').toEqual('');
      expectPath(ast, 'children.0.body.value').to.eql('');
      expectPath(ast, 'children.0.body.type').toEqual('RawMarkup');
      expectPath(ast, 'children.0.body.nodes').toEqual([]);

      ast = toLiquidAST(`
        {% doc -%}
        @param requiredParamWithNoType
        @param {String} paramWithDescription - param with description and \`punctation\`. This is still a valid param description.
        @param {String} paramWithNoDescription
        @param {String} [optionalParameterWithTypeAndDescription] - optional parameter with type and description
        @param [optionalParameterWithDescription] - optional parameter description
        @param {String} [optionalParameterWithType]
        @unsupported this node falls back to a text node
        {%- enddoc %}
      `);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');

      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.0.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.0.required').to.eql(true);
      expectPath(ast, 'children.0.body.nodes.0.paramName.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.0.paramName.value').to.eql('requiredParamWithNoType');
      expectPath(ast, 'children.0.body.nodes.0.paramType').to.be.null;
      expectPath(ast, 'children.0.body.nodes.0.paramDescription').to.be.null;

      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.1.required').to.eql(true);
      expectPath(ast, 'children.0.body.nodes.1.paramName.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.paramName.value').to.eql('paramWithDescription');
      expectPath(ast, 'children.0.body.nodes.1.paramDescription.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.paramDescription.value').to.eql(
        'param with description and `punctation`. This is still a valid param description.',
      );
      expectPath(ast, 'children.0.body.nodes.1.paramType.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.paramType.value').to.eql('String');

      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.2.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.2.paramName.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.2.paramName.value').to.eql('paramWithNoDescription');
      expectPath(ast, 'children.0.body.nodes.2.paramDescription').to.be.null;
      expectPath(ast, 'children.0.body.nodes.2.paramType.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.2.paramType.value').to.eql('String');

      expectPath(ast, 'children.0.body.nodes.3.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.3.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.3.required').to.eql(false);
      expectPath(ast, 'children.0.body.nodes.3.paramName.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.3.paramName.value').to.eql(
        'optionalParameterWithTypeAndDescription',
      );
      expectPath(ast, 'children.0.body.nodes.3.paramDescription.value').to.eql(
        'optional parameter with type and description',
      );
      expectPath(ast, 'children.0.body.nodes.3.paramType.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.3.paramType.value').to.eql('String');

      expectPath(ast, 'children.0.body.nodes.4.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.4.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.4.required').to.eql(false);
      expectPath(ast, 'children.0.body.nodes.4.paramName.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.4.paramName.value').to.eql(
        'optionalParameterWithDescription',
      );
      expectPath(ast, 'children.0.body.nodes.4.paramDescription.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.4.paramDescription.value').to.eql(
        'optional parameter description',
      );
      expectPath(ast, 'children.0.body.nodes.4.paramType').to.be.null;

      expectPath(ast, 'children.0.body.nodes.5.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.5.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.5.required').to.eql(false);
      expectPath(ast, 'children.0.body.nodes.5.paramName.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.5.paramName.value').to.eql(
        'optionalParameterWithType',
      );
      expectPath(ast, 'children.0.body.nodes.5.paramDescription').to.be.null;
      expectPath(ast, 'children.0.body.nodes.5.paramType.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.5.paramType.value').to.eql('String');

      expectPath(ast, 'children.0.body.nodes.6.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.6.value').to.eql(
        '@unsupported this node falls back to a text node',
      );

      ast = toLiquidAST(`
        {% doc -%}
        @example simple inline example
        {%- enddoc %}
      `);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
      expectPath(ast, 'children.0.body.nodes.0.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.0.content.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('simple inline example');

      ast = toLiquidAST(`
        {% doc -%}
        @example including inline code
        This is a valid example
        It can have multiple lines
        {% enddoc %}
      `);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.0.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql(
        'including inline code\n        This is a valid example\n        It can have multiple lines\n',
      );

      ast = toLiquidAST(`
        {% doc -%}
        @example
        First Example
        @example
        Second Example
        {% enddoc %}
      `);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.0.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('First Example\n');
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql('Second Example\n');

      ast = toLiquidAST(`
        {% doc -%}
        @example
        This is a valid example
        It can have multiple lines
        @param {String} paramWithDescription - param with description
        {% enddoc %}
      `);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.0.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql(
        'This is a valid example\n        It can have multiple lines\n',
      );
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.1.paramName.value').to.eql('paramWithDescription');
      expectPath(ast, 'children.0.body.nodes.1.paramDescription.value').to.eql(
        'param with description',
      );

      ast = toLiquidAST(`
        {% doc -%}
        @description This is a description
        @description This is another description
        it can have multiple lines
        {% enddoc %}
      `);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('This is a description');
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql(
        'This is another description\n        it can have multiple lines\n',
      );

      ast = toLiquidAST(`
        {% doc -%}
        @description This is a description
        @example This is an example
        @param {String} paramWithDescription - param with description
        {% enddoc %}
      `);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('This is a description');

      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql('This is an example');

      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.2.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.2.paramName.value').to.eql('paramWithDescription');
      expectPath(ast, 'children.0.body.nodes.2.paramDescription.value').to.eql(
        'param with description',
      );

      ast = toLiquidAST(`
        {% doc -%}
        this is an implicit description
        in a header

        @description with a description annotation
        {% enddoc %}
      `);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql(
        'this is an implicit description\n        in a header\n\n',
      );
      expectPath(ast, 'children.0.body.nodes.0.isImplicit').to.eql(true);

      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql(
        'with a description annotation',
      );
      expectPath(ast, 'children.0.body.nodes.1.isImplicit').to.eql(false);

      ast = toLiquidAST(`
{% doc -%}
  @prompt
    This is a prompt
    It can have multiple lines
{% enddoc %}`);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocPromptNode');
      expectPath(ast, 'children.0.body.nodes.0.name').to.eql('prompt');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql(
        '\n    This is a prompt\n    It can have multiple lines\n',
      );

      ast = toLiquidAST(`
{% doc -%}
  this block was AI generated

  @prompt
    First prompt

  @param {String} paramName - param description
{% enddoc %}
      `);
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql(
        'this block was AI generated\n\n',
      );
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocPromptNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('prompt');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql('\n    First prompt\n\n');
      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.2.paramName.value').to.eql('paramName');
    });

    it('should split doc body at mid-line @word patterns', () => {
      // Regression: mid-line `@utility` in description text must split
      // into description + unsupported annotation TextNode (Bug 26)
      ast = toLiquidAST(`
{% doc %}
  Description text with \`@utility\` mid-line token.

  @param {string} [name] - A param
  @category content
{% enddoc %}`);
      // Description stops before `@utility`
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('Description text with `');
      // `@utility` becomes an unsupported annotation TextNode
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.value').to.eql('@utility` mid-line token.');
      // Param still parsed correctly
      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.2.paramName.value').to.eql('name');
      // @category becomes an unsupported annotation TextNode
      expectPath(ast, 'children.0.body.nodes.3.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.3.value').to.eql('@category content');

      // Mid-line @word in inline content after @param should NOT split
      ast = toLiquidAST(`
{% doc %}
  @param {string} id - Unique id. @required
  @category content
{% enddoc %}`);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.0.paramDescription.value').to.eql(
        'Unique id. @required',
      );
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.value').to.eql('@category content');

      // Bug 43 Pattern 3: multiline @param descriptions spanning continuation lines
      ast = toLiquidAST(`{% doc %}
  @param {string} [alignment] - The horizontal alignment
  ('left', 'center', or 'right'). Defaults to 'center'.
  @param {boolean} [full_width] - Spans full width.
{% enddoc %}`);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.0.paramName.value').to.eql('alignment');
      expectPath(ast, 'children.0.body.nodes.0.paramDescription.value').to.eql(
        "The horizontal alignment\n  ('left', 'center', or 'right'). Defaults to 'center'.",
      );
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.1.paramName.value').to.eql('full_width');

      // Bug 43 Pattern 4: optional @param without description includes bracket in end position
      ast = toLiquidAST(`{% doc %}
  @param {number} index
  @param {boolean} [current]
  @param {boolean} [image_only]
{% enddoc %}`);
      // Required param end = end of name word
      const indexParam = ast.children[0].body.nodes[0];
      expect(indexParam.position.end).to.eql(indexParam.paramName.position.end);
      // Optional param end = end of closing bracket (past paramName.position.end)
      const currentParam = ast.children[0].body.nodes[1];
      expect(currentParam.position.end).to.be.greaterThan(currentParam.paramName.position.end);
      const imageOnlyParam = ast.children[0].body.nodes[2];
      expect(imageOnlyParam.position.end).to.be.greaterThan(imageOnlyParam.paramName.position.end);
    });

    it('should parse unclosed tables with assignments', () => {
      ast = toLiquidAST(`
        {%- liquid
          assign var1 = product
        -%}
        <table>
          {% tablerow var2 in collections.first.products %}
            {% assign var3 = var2 %}
            {{ var3.title }}
      `);

      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('liquid');
      expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.markup.0.name').to.eql('assign');
      expectPath(ast, 'children.0.markup.0.markup.name').to.eql('var1');

      expectPath(ast, 'children.1.type').to.eql('TextNode');
      expectPath(ast, 'children.1.value').to.eql('<table>');

      expectPath(ast, 'children.2.type').to.eql('LiquidTag');
      expectPath(ast, 'children.2.name').to.eql('tablerow');
    });

    it('should parse script tags as a text node', () => {
      ast = toLiquidAST(`<script>\n  const a = {{ product | json }};\n</script>`);

      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<script>\n  const a =');
    });

    it('should parse style tags as a text node', () => {
      ast = toLiquidAST(`<style>\n  :root { --bg: {{ settings.bg }}}\n</style>`);

      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<style>\n  :root { --bg:');
    });

    it('should allow for dangling html open tags inside branches when the conditions are right', () => {
      ['if', 'unless'].forEach((conditional) => {
        ast = toLiquidHtmlAST(`
        {% ${conditional} condition %}
          <section class="unclosed">
        {% end${conditional} %}
      `);
        expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.0.children.0.type').to.equal('HtmlElement');
        expectPath(ast, 'children.0.children.0.children.0.attributes.0.name.0.value').to.equal(
          'class',
        );
        expectPath(ast, 'children.0.children.0.children.0.attributes.0.value.0.value').to.equal(
          'unclosed',
        );

        ast = toLiquidHtmlAST(`
        {% ${conditional} condition %}
          <section class="unclosed">
        {% else %}
          <section class="unclosed">
        {% end${conditional} %}
      `);
        expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.0.children.0.type').to.equal('HtmlElement');
        expectPath(ast, 'children.0.children.0.children.0.attributes.0.name.0.value').to.equal(
          'class',
        );
        expectPath(ast, 'children.0.children.0.children.0.attributes.0.value.0.value').to.equal(
          'unclosed',
        );

        expectPath(ast, 'children.0.children.1.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.1.children.0.type').to.equal('HtmlElement');
        expectPath(ast, 'children.0.children.1.children.0.attributes.0.name.0.value').to.equal(
          'class',
        );
        expectPath(ast, 'children.0.children.1.children.0.attributes.0.value.0.value').to.equal(
          'unclosed',
        );
      });
    });

    it('should allow for dangling html close tags inside branches when the conditions are right', () => {
      ['if', 'unless'].forEach((conditional) => {
        ast = toLiquidHtmlAST(`
        {% ${conditional} condition %}
          </section>
        {% end${conditional} %}
      `);
        expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.0.children.0.type').to.equal(
          'HtmlDanglingMarkerClose',
        );

        ast = toLiquidHtmlAST(`
        {% ${conditional} condition %}
          </section>
        {% else %}
          </main>
        {% end${conditional} %}
      `);
        expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.0.children.0.type').to.equal(
          'HtmlDanglingMarkerClose',
        );
        expectPath(ast, 'children.0.children.0.children.0.name.0.value').to.equal('section');

        expectPath(ast, 'children.0.children.1.type').to.equal('LiquidBranch');
        expectPath(ast, 'children.0.children.1.children.0.type').to.equal(
          'HtmlDanglingMarkerClose',
        );
        expectPath(ast, 'children.0.children.1.children.0.name.0.value').to.equal('main');
      });
    });
  });

  describe('toLiquidHTML(test, mode: completion)', () => {
    const toAST = (source: string) =>
      toLiquidHtmlAST(source, { mode: 'completion', allowUnclosedDocumentNode: true });
    const expectPath = makeExpectPath('toLiquidHTML(test, mode: completion)');

    it.skip('should not freak out when parsing dangling closing nodes outside of the normally accepted context', () => {
      ast = toAST(`<h1></h█>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.children.0.type').to.equal('HtmlDanglingMarkerClose');
      expectPath(ast, 'children.0.children.0.name.0.value').to.equal('h█');
    });

    it('should not freak out when parsing dangling open node outside of the normally accepted context', () => {
      ast = toAST(`<h█>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.name.0.value').to.equal('h█');
    });

    it.skip('should not freak out when parsing incomplete named arguments for content_for tags', () => {
      ast = toAST(`{% content_for "blocks", id: 1, cl█ %}`);

      expectPath(ast, 'children.0.type').to.equal('LiquidTag');
      expectPath(ast, 'children.0.markup.args.0.type').to.equal('NamedArgument');
      expectPath(ast, 'children.0.markup.args.1.type').to.equal('VariableLookup');
      expectPath(ast, 'children.0.markup.args').to.have.lengthOf(2);
    });

    it.skip('should not freak out when parsing dangling liquid tags', () => {
      ast = toAST(`<h {% if cond %}attr{% end█ %}>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.attributes.0.type').to.equal('LiquidTag');
      expectPath(ast, 'children.0.attributes.0.children.0.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.attributes.0.children.0.children.1.type').to.equal('LiquidTag');
    });

    it.skip('should not freak out when completing doc tags', () => {
      ast = toAST(`
        {% doc %}
        @description This is a description
        @example This is an example
        @param {String} paramWithDescription - param with description
        @p█
      `);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('This is a description');

      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql('This is an example');

      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.2.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.2.paramName.value').to.eql('paramWithDescription');

      expectPath(ast, 'children.0.body.nodes.3.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.3.value').to.eql('@p█');
    });
  });

  describe('Bug 41: comment/doc body inside {% liquid %}', () => {
    const testCases = [
      {
        expectPath: makeExpectPath('toLiquidHtmlAST(text)'),
        toAST: toLiquidHtmlAST,
      },
      {
        expectPath: makeExpectPath('toLiquidAST(text)'),
        toAST: toLiquidAST,
      },
    ];

    it('should not include a leading newline in comment body.value inside {% liquid %}', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST('{% liquid\ncomment\nthis is a comment\nendcomment\n%}');
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('liquid');
        // liquid tag statements are in markup array
        expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidRawTag');
        expectPath(ast, 'children.0.markup.0.name').to.eql('comment');
        // body.value must NOT start with \n
        const bodyValue = deepGet('children.0.markup.0.body.value'.split('.'), ast);
        expect(bodyValue, 'body.value should not start with \\n').to.satisfy(
          (v: string) => !v.startsWith('\n'),
        );
      }
    });

    it('should have non-empty body.nodes for comment inside {% liquid %}', () => {
      for (const { toAST, expectPath } of testCases) {
        ast = toAST('{% liquid\ncomment\nthis is a comment\nendcomment\n%}');
        expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidRawTag');
        expectPath(ast, 'children.0.markup.0.body.nodes').to.have.length.greaterThan(0);
        expectPath(ast, 'children.0.markup.0.body.nodes.0.type').to.eql('TextNode');
      }
    });
  });

  function makeExpectPath(message: string) {
    return function expectPath(ast: LiquidHtmlNode, path: string) {
      return expect(deepGet(path.split('.'), ast), message);
    };
  }

  function makeExpectPosition(message: string) {
    const expectPath = makeExpectPath(message);
    return function expectPosition(
      ast: LiquidHtmlNode,
      path: string,
      positionProp: string = 'position',
    ) {
      expectPath(ast, path + `.${positionProp}.start`).to.be.a('number');
      expectPath(ast, path + `.${positionProp}.end`).to.be.a('number');
      const start = deepGet((path + `.${positionProp}.start`).split('.'), ast);
      const end = deepGet((path + `.${positionProp}.end`).split('.'), ast);
      return expect(ast.source.slice(start, end));
    };
  }
});
