import { expect } from 'chai';
import { toLiquidHtmlAST, toLiquidAST, LiquidHtmlNode } from '~/parser/stage-2-ast';
import { deepGet } from '~/utils';

describe('Unit: Stage 2 (AST)', () => {
  let ast: any;
  describe('Unit: toLiquidHtmlAST(text) and toLiquidAST(text)', () => {
    [
      {
        title: 'toLiquidHtmlAST(text)',
        fn: toLiquidHtmlAST,
      },
      {
        title: 'toLiquidAST(text)',
        fn: toLiquidAST,
      },
    ].forEach((testContext) => {
      const title = testContext.title;
      const toAST = testContext.fn;

      describe(`${title} - Unit: LiquidDrop`, () => {
        it('should transform a base case Liquid Drop into a LiquidDrop', () => {
          ast = toAST('{{ !-asd }}');
          expectPath(ast, 'children.0').to.exist;
          expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
          expectPath(ast, 'children.0.markup').to.eql('!-asd');
          expectPosition(ast, 'children.0');
        });

        it('should parse strings as LiquidVariable > String', () => {
          [
            { expression: `"string o' string"`, value: `string o' string`, single: false },
            { expression: `'He said: "hi!"'`, value: `He said: "hi!"`, single: true },
          ].forEach(({ expression, value, single }) => {
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('String');
            expectPath(ast, 'children.0.markup.expression.value').to.eql(value);
            expectPath(ast, 'children.0.markup.expression.single').to.eql(single);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
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
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('Number');
            expectPath(ast, 'children.0.markup.expression.value').to.eql(value);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
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
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
            expectPath(ast, 'children.0.markup.type').to.eql('LiquidVariable');
            expectPath(ast, 'children.0.markup.rawSource').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.type').to.eql('LiquidLiteral');
            expectPath(ast, 'children.0.markup.expression.keyword').to.eql(expression);
            expectPath(ast, 'children.0.markup.expression.value').to.eql(value);
            expectPosition(ast, 'children.0');
            expectPosition(ast, 'children.0.markup');
            expectPosition(ast, 'children.0.markup.expression');
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
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
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
            ast = toAST(`{{ ${expression} }}`);
            expectPath(ast, 'children.0').to.exist;
            expectPath(ast, 'children.0.type').to.eql('LiquidDrop');
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
            ast = toAST(`{{ 'hello' ${expression} }}`);
            expectPath(ast, 'children.0.type').to.equal('LiquidDrop');
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
          });
        });
      });

      describe(`${title} - Case: LiquidTag`, () => {
        it('should transform a basic Liquid Tag into a LiquidTag', () => {
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
        });

        it('should parse echo tags', () => {
          [
            { expression: `"hi"`, expressionType: 'String', expressionValue: 'hi', filters: [] },
            { expression: `x | f`, expressionType: 'VariableLookup', filters: ['f'] },
          ].forEach(({ expression, expressionType, expressionValue, filters }) => {
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
              alias: 'foo',
              renderVariableExpression: null,
              namedArguments: [],
            },
            {
              expression: `"snippet" with "string" as foo`,
              snippetType: 'String',
              alias: 'foo',
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
              alias: 'product',
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
              alias: 'foo',
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
              expectPath(ast, 'children.0.markup.alias').to.equal(alias);
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
            },
          );
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
            });
          });
        });
      });

      it(`${title} - should parse liquid inline comments`, () => {
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
      });

      it(`${title} - should parse liquid case as branches`, () => {
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
      });

      it(`${title} - should parse liquid ifs as branches`, () => {
        ast = toAST(`{% if A %}A{% elsif B %}B{% else %}C{% endif %}`);
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('LiquidTag');
        expectPath(ast, 'children.0.name').to.eql('if');
        expectPath(ast, 'children.0.children.0').to.exist;
        expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
        expectPath(ast, 'children.0.children.0.name').to.eql(null);
        expectPath(ast, 'children.0.children.0.markup').to.eql('');
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
      });

      it(`${title} - should parse a basic text node into a TextNode`, () => {
        ast = toAST('Hello world!');
        expectPath(ast, 'children.0').to.exist;
        expectPath(ast, 'children.0.type').to.eql('TextNode');
        expectPath(ast, 'children.0.value').to.eql('Hello world!');
        expectPosition(ast, 'children.0');
      });
    });
  });

  describe('Unit: toLiquidHtmlAST(text)', () => {
    let ast: any;

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
        expectPath(ast, 'children.0.name.0.type').to.eql('LiquidDrop');
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
      expectPath(ast, 'children.0.name.0.type').to.eql('LiquidDrop');
      expectPath(ast, 'children.0.name.0.markup.type').to.eql('LiquidVariable');
      expectPath(ast, 'children.0.name.0.markup.rawSource').to.eql('node_type');
      expectPath(ast, 'children.0.name.1.value').to.eql('--header');
    });

    it('should parse HTML self-closing elements with compound Liquid Drop names', () => {
      ast = toLiquidHtmlAST(`<{{ node_type }}--header />`);
      expectPath(ast, 'children.0').to.exist;
      expectPath(ast, 'children.0.type').to.eql('HtmlSelfClosingElement');
      expectPath(ast, 'children.0.name.0.type').to.eql('LiquidDrop');
      expectPath(ast, 'children.0.name.0.markup.type').to.eql('LiquidVariable');
      expectPath(ast, 'children.0.name.0.markup.rawSource').to.eql('node_type');
      expectPath(ast, 'children.0.name.1.value').to.eql('--header');
    });

    it('should allow for at most 2 unclosed nodes in a LiquidBranch', () => {
      // two empty nodes = ok
      let testCases = [
        '{% if cond %}<div>{% endif %}',
        '{% if cond %}{% else %}<div>{% endif %}',
        '{% if cond %}<div>{% else %}{% endif %}',
        '{% if cond %}{% elsif cond %}<div>{% endif %}',
        '{% if cond %}<div><a>{% endif %}',
        '{% if cond %}{% else %}<div><a>{% endif %}',
        '{% if cond %}{% elsif cond %}<div><a>{% endif %}',
        '{% case cond %}{% when %}<div><a>{% endcase %}',
      ];
      for (const testCase of testCases) {
        expect(() => toLiquidHtmlAST(testCase), testCase).not.to.throw();
      }

      // 3 nodes = not ok
      testCases = [
        '{% if cond %}<a><b><c>{% endif %}',
        '{% if cond %}{% else %}<a><b><c>{% endif %}',
        '{% if cond %}{% elsif cond %}<a><b><c>{% endif %}',
        '{% case cond %}{% when %}<a><b><c>{% endcase %}',
      ];
      for (const testCase of testCases) {
        expect(() => toLiquidHtmlAST(testCase), testCase).to.throw(
          /Attempting to close LiquidTag '[^']+' before HtmlElement 'c' was closed/,
        );
      }

      // 2 nodes but with children = not ok
      testCases = [
        '{% if cond %}<a>hi</a><b>{% endif %}',
        '{% if cond %}<b><a>hi</a>{% endif %}',
        '{% if cond %}{% else %}<a>hi</a><b>{% endif %}',
        '{% if cond %}{% else %}<b><a>hi</a>{% endif %}',
        '{% if cond %}{% elsif cond %}<a>hi</a><b>{% endif %}',
        '{% if cond %}{% elsif cond %}<b><a>hi</a>{% endif %}',
        '{% case cond %}{% when %}<a>hi</a><b>{% endcase %}',
      ];
      for (const testCase of testCases) {
        expect(() => toLiquidHtmlAST(testCase), testCase).to.throw(
          /Attempting to close LiquidTag '[^']+' before HtmlElement 'b' was closed/,
        );
      }
    });

    it('should throw when trying to close the wrong node', () => {
      const testCases = [
        '<a><div></a>',
        '{% for a in b %}<div>{% endfor %}',
        '{% for a in b %}{% if condition %}{% endfor %}',
        '<{{ node_type }}><div></{{ node_type }}>',
        '<{{ node_type }}></{{ wrong_end_node }}>',
      ];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlAST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLCSTParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.message, testCase).to.match(
            /Attempting to close \w+ '[^']+' before \w+ '[^']+' was closed/,
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
          expect(true, `expected ${testCase} to throw LiquidHTMLCSTParsingError`).to.be.false;
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
          expect(true, `expected ${testCase} to throw LiquidHTMLCSTParsingError`).to.be.false;
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
      expectPosition(ast, 'children.0');
    });

    it('should parse style tags as raw markup', () => {
      ast = toLiquidHtmlAST(`<style>\n  :root { --bg: {{ settings.bg }}}\n</style>`);
      expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
      expectPath(ast, 'children.0.name').to.eql('style');
      expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
      expectPath(ast, 'children.0.body.kind').to.eql('text');
      expectPath(ast, 'children.0.body.value').to.eql('\n  :root { --bg: {{ settings.bg }}}\n');
      expectPosition(ast, 'children.0');
    });
  });

  describe('Unit: toLiquidAST(text)', () => {
    let ast: any;

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
  });

  it('should allow for dangling html open tags inside branches when the conditions are right', () => {
    ['if', 'unless'].forEach((conditional) => {
      ast = toLiquidHtmlAST(`
        {% ${conditional} condition %}
          <section class="unclosed">
        {% end${conditional} %}
      `);
      expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.children.0.children.0.type').to.equal('HtmlDanglingMarkerOpen');
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
      expectPath(ast, 'children.0.children.0.children.0.type').to.equal('HtmlDanglingMarkerOpen');
      expectPath(ast, 'children.0.children.0.children.0.attributes.0.name.0.value').to.equal(
        'class',
      );
      expectPath(ast, 'children.0.children.0.children.0.attributes.0.value.0.value').to.equal(
        'unclosed',
      );

      expectPath(ast, 'children.0.children.1.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.children.1.children.0.type').to.equal('HtmlDanglingMarkerOpen');
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
      expectPath(ast, 'children.0.children.0.children.0.type').to.equal('HtmlDanglingMarkerClose');

      ast = toLiquidHtmlAST(`
        {% ${conditional} condition %}
          </section>
        {% else %}
          </main>
        {% end${conditional} %}
      `);
      expectPath(ast, 'children.0.children.0.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.children.0.children.0.type').to.equal('HtmlDanglingMarkerClose');
      expectPath(ast, 'children.0.children.0.children.0.name.0.value').to.equal('section');

      expectPath(ast, 'children.0.children.1.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.children.1.children.0.type').to.equal('HtmlDanglingMarkerClose');
      expectPath(ast, 'children.0.children.1.children.0.name.0.value').to.equal('main');
    });
  });

  function expectPath(ast: LiquidHtmlNode, path: string) {
    return expect(deepGet(path.split('.'), ast));
  }

  function expectPosition(ast: LiquidHtmlNode, path: string) {
    expectPath(ast, path + '.position.start').to.be.a('number');
    expectPath(ast, path + '.position.end').to.be.a('number');
  }
});
