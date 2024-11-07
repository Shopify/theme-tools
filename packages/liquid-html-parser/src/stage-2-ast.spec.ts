import { expect, it, describe } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST, LiquidHtmlNode, DocumentNode } from './stage-2-ast';
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
            }
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
      expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(3);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('TextNode');
      expectPosition(ast, 'children.0.body.nodes.0').toEqual('const a =');
      expectPosition(ast, 'children.0.body.nodes.1').toEqual('{{ product | json }}');
      expectPosition(ast, 'children.0.body.nodes.2').toEqual(';');
      expectPosition(ast, 'children.0');
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

    it('should not freak out when parsing dangling closing nodes outside of the normally accepted context', () => {
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

    it('should not freak out when parsing dangling liquid tags', () => {
      ast = toAST(`<h {% if cond %}attr{% end█ %}>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.attributes.0.type').to.equal('LiquidTag');
      expectPath(ast, 'children.0.attributes.0.children.0.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.attributes.0.children.0.children.1.type').to.equal('LiquidTag');
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
