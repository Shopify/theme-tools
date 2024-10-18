import { expect, it, describe } from 'vitest';
import {
  LiquidHtmlCST,
  toLiquidHtmlCST,
  toLiquidCST,
  LiquidCST,
  ConcreteLiquidTagLiquid,
} from './stage-1-cst';
import { BLOCKS, VOID_ELEMENTS } from './grammar';
import { NamedTags } from './types';
import { deepGet } from './utils';

describe('Unit: Stage 1 (CST)', () => {
  describe('Unit: toLiquidHtmlCST(text) and toLiquidCST(text)', () => {
    const testCases = [
      {
        expectPath: makeExpectPath('toLiquidHtmlCST(text)'),
        toCST: toLiquidHtmlCST,
      },
      {
        expectPath: makeExpectPath('toLiquidCST(text)'),
        toCST: toLiquidCST,
      },
    ];

    let cst: LiquidHtmlCST | LiquidCST;

    describe('Case: LiquidVariableOutput', () => {
      it('should basically parse unparseables', () => {
        for (const { toCST, expectPath } of testCases) {
          cst = toCST('{{ !-asdl }}{{- !-asdl -}}');
          expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
          expectPath(cst, '0.markup').to.equal('!-asdl');
          expectPath(cst, '0.whitespaceStart').to.equal(null);
          expectPath(cst, '0.whitespaceEnd').to.equal(null);
          expectPath(cst, '1.type').to.equal('LiquidVariableOutput');
          expectPath(cst, '1.markup').to.equal('!-asdl');
          expectPath(cst, '1.whitespaceStart').to.equal('-');
          expectPath(cst, '1.whitespaceEnd').to.equal('-');
        }
      });

      it('should parse strings', () => {
        [
          { expression: `"string o' string"`, value: `string o' string`, single: false },
          { expression: `'He said: "hi!"'`, value: `He said: "hi!"`, single: true },
        ].forEach(({ expression, value, single }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{{ ${expression} }}`);
            expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
            expectPath(cst, '0.markup.rawSource').to.equal(expression);
            expectPath(cst, '0.markup.expression.type').to.equal('String');
            expectPath(cst, '0.markup.expression.value').to.equal(value);
            expectPath(cst, '0.markup.expression.single').to.equal(single);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal(null);
          }
        });
      });

      it('should parse numbers', () => {
        [
          { expression: `1`, value: '1' },
          { expression: `1.02`, value: '1.02' },
          { expression: `0`, value: '0' },
          { expression: `-0`, value: '-0' },
          { expression: `-0.0`, value: '-0.0' },
        ].forEach(({ expression, value }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{{ ${expression} }}`);
            expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
            expectPath(cst, '0.markup.rawSource').to.equal(expression);
            expectPath(cst, '0.markup.expression.type').to.equal('Number');
            expectPath(cst, '0.markup.expression.value').to.equal(value);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal(null);
          }
        });
      });

      it('should parse Liquid literals', () => {
        [
          { expression: `nil`, value: null },
          { expression: `null`, value: null },
          { expression: `true`, value: true },
          { expression: `blank`, value: '' },
          { expression: `empty`, value: '' },
        ].forEach(({ expression, value }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{{ ${expression} }}`);
            expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable', expression);
            expectPath(cst, '0.markup.rawSource').to.equal(expression);
            expectPath(cst, '0.markup.expression.type').to.equal('LiquidLiteral');
            expectPath(cst, '0.markup.expression.keyword').to.equal(expression);
            expectPath(cst, '0.markup.expression.value').to.equal(value);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal(null);
          }
        });
      });

      interface Lookup {
        type: 'VariableLookup';
        lookups: (string | number | Lookup)[];
        name: string | undefined;
      }

      it('should parse variable lookups', () => {
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
          { expression: `true_thing`, name: 'true_thing', lookups: [] },
          { expression: `null_thing`, name: 'null_thing', lookups: [] },
        ].forEach(({ expression, name, lookups }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{{ ${expression} }}`);
            expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable', expression);
            expectPath(cst, '0.markup.rawSource').to.equal(expression);
            expectPath(cst, '0.markup.expression.type').to.equal('VariableLookup');
            expectPath(cst, '0.markup.expression.name').to.equal(name, expression);
            expectPath(cst, '0.markup.expression.lookups').to.be.an('array');

            lookups.forEach((lookup: string | number | Lookup, i: number) => {
              switch (typeof lookup) {
                case 'string': {
                  expectPath(cst, `0.markup.expression.lookups.${i}.type`).to.equal('String');
                  expectPath(cst, `0.markup.expression.lookups.${i}.value`).to.equal(lookup);
                  break;
                }
                case 'number': {
                  expectPath(cst, `0.markup.expression.lookups.${i}.type`).to.equal('Number');
                  expectPath(cst, `0.markup.expression.lookups.${i}.value`).to.equal(
                    lookup.toString(),
                  );
                  break;
                }
                default: {
                  expectPath(cst, `0.markup.expression.lookups.${i}.type`).to.equal(
                    'VariableLookup',
                  );
                  expectPath(cst, `0.markup.expression.lookups.${i}.name`).to.equal(lookup.name);
                  lookup.lookups.forEach((val, j) => {
                    // Being lazy here... Assuming string properties.
                    expectPath(cst, `0.markup.expression.lookups.${i}.lookups.${j}.type`).to.equal(
                      'String',
                    );
                    expectPath(cst, `0.markup.expression.lookups.${i}.lookups.${j}.value`).to.equal(
                      val,
                    );
                  });
                  break;
                }
              }
            });

            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal(null);
          }
        });
      });

      it('should parse ranges', () => {
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
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{{ ${expression} }}`);
            expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable', expression);
            expectPath(cst, '0.markup.rawSource').to.equal(expression);
            expectPath(cst, '0.markup.expression.type').to.equal('Range');
            expectPath(cst, '0.markup.expression.start.type').to.equal(start.type);
            expectPath(cst, '0.markup.expression.start.value').to.equal(start.value);
            expectPath(cst, '0.markup.expression.end.type').to.equal(end.type);
            expectPath(cst, '0.markup.expression.end.value').to.equal(end.value);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal(null);
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
          { expression: '', filters: [] },
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
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{{ 'hello' ${expression} }}`);
            expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
            expectPath(cst, '0.markup.rawSource').to.equal((`'hello' ` + expression).trimEnd());
            expectPath(cst, '0.markup.filters').to.exist;
            expectPath(cst, '0.markup.filters').to.have.lengthOf(filters.length);
            filters.forEach((filter, i) => {
              expectPath(cst, `0.markup.filters.${i}`).to.exist;
              expectPath(cst, `0.markup.filters.${i}.type`).to.equal('LiquidFilter', expression);
              expectPath(cst, `0.markup.filters.${i}.name`).to.equal(filter.name);
              expectPath(cst, `0.markup.filters.${i}.args`).to.exist;
              expectPath(cst, `0.markup.filters.${i}.args`).to.have.lengthOf(
                filter.args.length,
                expression,
              );
              filter.args.forEach((arg: any, j) => {
                switch (arg.type) {
                  case 'String': {
                    expectPath(cst, `0.markup.filters.${i}.args.${j}.type`).to.equal('String');
                    expectPath(cst, `0.markup.filters.${i}.args.${j}.value`).to.equal(arg.value);
                    break;
                  }
                  case 'NamedArgument': {
                    expectPath(cst, `0.markup.filters.${i}.args`).to.not.be.empty;
                    expectPath(cst, `0.markup.filters.${i}.args.${j}.type`).to.equal(
                      'NamedArgument',
                    );
                    expectPath(cst, `0.markup.filters.${i}.args.${j}.name`).to.equal(arg.name);
                    expectPath(cst, `0.markup.filters.${i}.args.${j}.value.type`).to.equal(
                      arg.valueType,
                    );
                    break;
                  }
                }
              });
            });
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal(null);
          }
        });
      });

      it('correctly parses the whitespace stripping behaviour as part of LiquidVariableOutput and not the variable name', () => {
        for (const { toCST, expectPath } of testCases) {
          cst = toCST(`{{somevarname-}}`);
          expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
          expectPath(cst, '0.whitespaceEnd').to.equal('-');
          expectPath(cst, '0.whitespaceStart').to.equal(null);
          expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
          expectPath(cst, '0.markup.expression.type').to.equal('VariableLookup');
          expectPath(cst, '0.markup.expression.name').to.equal('somevarname');
          expectPath(cst, '0.markup.expression.lookups').to.eql([]);
        }
      });
    });

    describe('Case: LiquidTag', () => {
      it('should parse the liquid liquid tag as a list of tags', () => {
        [
          [
            {
              expression: `echo "hi"`,
              type: 'LiquidTag',
              name: 'echo',
            },
            {
              expression: `
                comment
                  hello there
                  got you, eh?
                endcomment`,
              type: 'LiquidRawTag',
              name: 'comment',
            },
            {
              expression: `
                if cond
              `,
              type: 'LiquidTagOpen',
              name: 'if',
            },
            {
              expression: `
                endif
              `,
              type: 'LiquidTagClose',
              name: 'if',
            },
            {
              expression: `
                # this is an inline comment
              `,
              type: 'LiquidTag',
              name: '#',
            },
          ],
        ].forEach((expressions) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% liquid \n${expressions.map((x) => x.expression).join('\n')} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTag');
            expectPath(cst, '0.name').to.equal('liquid');
            expressions.forEach(({ type, name }, i) => {
              expectPath(cst, `0.markup.${i}.type`).to.equal(type);
              expectPath(cst, `0.markup.${i}.name`).to.equal(name);
            });
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
          }
        });
      });

      it('should support nested comments', () => {
        for (const { toCST, expectPath } of testCases) {
          const commentBodyContainingNestedComment = `  hello
        comment tagMarkup
          nested comment body
        endcomment
          outer comment body`;
          const statementSep = '\n  ';
          const commentExpr = ['comment', commentBodyContainingNestedComment, 'endcomment'].join(
            statementSep,
          );
          const testStr = ['{% liquid', commentExpr, '%}'].join('\n');
          cst = toCST(testStr);
          expectPath(cst, '0.type').to.equal('LiquidTag');
          expectPath(cst, '0.name').to.equal('liquid');
          expectPath(cst, '0.markup.0.type').to.equal('LiquidRawTag');
          expectPath(cst, '0.markup.0.name').to.equal('comment');
          expectPath(cst, '0.markup.0.body').to.equal(
            // We don't want the newline but we do want the leading spaces
            // The reason we want that is because we want this to behave like LiquidRawTag
            statementSep.slice(1) + commentBodyContainingNestedComment + statementSep,
          );
          expectPath(cst, '0.markup.0.whitespaceStart').to.equal('');
          expectPath(cst, '0.markup.0.whitespaceEnd').to.equal('');
          expectPath(cst, '0.markup.0.delimiterWhitespaceStart').to.equal('');
          expectPath(cst, '0.markup.0.delimiterWhitespaceEnd').to.equal('');

          const liquidStatementOffset = '{% liquid\n'.length;
          expectPath(cst, '0.markup.0.blockStartLocStart').to.equal(liquidStatementOffset);
          expectPath(cst, '0.markup.0.blockStartLocEnd').to.equal(
            liquidStatementOffset + 'comment'.length,
          );
          expectPath(cst, '0.markup.0.blockEndLocStart').to.equal(
            testStr.length - 'endcomment\n%}'.length,
          );
          expectPath(cst, '0.markup.0.blockEndLocEnd').to.equal(testStr.length - '\n%}'.length);
        }
      });

      it('should parse incomplete parameters for filters', () => {
        for (const { toCST, expectPath } of testCases) {
          cst = toCST(`{{ a[1].foo | filtername: 10, myvar.foo, a1: 2, a2 }}`);
          expectPath(cst, '0.type').to.equal('LiquidVariableOutput');
        }
      });

      it('should parse the echo tag as variables', () => {
        [
          { expression: `"hi"`, expressionType: 'String', expressionValue: 'hi', filters: [] },
          { expression: `x | f`, expressionType: 'VariableLookup', filters: ['f'] },
        ].forEach(({ expression, expressionType, expressionValue, filters }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% echo ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTag');
            expectPath(cst, '0.name').to.equal('echo');
            expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
            expectPath(cst, '0.markup.expression.type').to.equal(expressionType);
            if (expressionValue) {
              expectPath(cst, '0.markup.expression.value').to.equal(expressionValue);
            }
            expectPath(cst, '0.markup.filters').to.have.lengthOf(filters.length);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
          }
        });
      });

      it('should parse the assign tag as assign markup + liquid variable', () => {
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
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% assign ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTag');
            expectPath(cst, '0.name').to.equal('assign');
            expectPath(cst, '0.markup.type').to.equal('AssignMarkup');
            expectPath(cst, '0.markup.name').to.equal(name);
            expectPath(cst, '0.markup.value.expression.type').to.equal(expressionType);
            if (expressionValue) {
              expectPath(cst, '0.markup.value.expression.value').to.equal(expressionValue);
            }
            expectPath(cst, '0.markup.value.filters').to.have.lengthOf(filters.length);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
          }
        });
      });

      it('should parse the cycle tag as cycle markup', () => {
        [
          {
            expression: `a, "string", 10`,
            groupName: null,
            args: [{ type: 'VariableLookup' }, { type: 'String' }, { type: 'Number' }],
          },
          {
            expression: `var: a, "string", 10`,
            groupName: { type: 'VariableLookup' },
            args: [{ type: 'VariableLookup' }, { type: 'String' }, { type: 'Number' }],
          },
        ].forEach(({ expression, groupName, args }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% cycle ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTag');
            expectPath(cst, '0.name').to.equal('cycle');
            expectPath(cst, '0.markup.type').to.equal('CycleMarkup');
            if (groupName) {
              expectPath(cst, '0.markup.groupName.type').to.equal(groupName.type);
            } else {
              expectPath(cst, '0.markup.groupName').to.equal(null);
            }
            expectPath(cst, '0.markup.args').to.have.lengthOf(args.length);
            args.forEach((arg, i) => {
              expectPath(cst, `0.markup.args.${i}.type`).to.equal(arg.type);
            });
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
          }
        });
      });

      it('should parse the render tag', () => {
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
            for (const { toCST, expectPath } of testCases) {
              cst = toCST(`{% render ${expression} -%}`);
              expectPath(cst, '0.type').to.equal('LiquidTag');
              expectPath(cst, '0.name').to.equal('render');
              expectPath(cst, '0.markup.type').to.equal('RenderMarkup');
              expectPath(cst, '0.markup.snippet.type').to.equal(snippetType);
              if (renderVariableExpression) {
                expectPath(cst, '0.markup.variable.type').to.equal('RenderVariableExpression');
                expectPath(cst, '0.markup.variable.kind').to.equal(renderVariableExpression.kind);
                expectPath(cst, '0.markup.variable.name.type').to.equal(
                  renderVariableExpression.name.type,
                );
              } else {
                expectPath(cst, '0.markup.variable').to.equal(null);
              }
              expectPath(cst, '0.markup.alias').to.equal(alias);
              expectPath(cst, '0.markup.args').to.have.lengthOf(namedArguments.length);
              namedArguments.forEach(({ name, valueType }, i) => {
                expectPath(cst, `0.markup.args.${i}.type`).to.equal('NamedArgument');
                expectPath(cst, `0.markup.args.${i}.name`).to.equal(name);
                expectPath(cst, `0.markup.args.${i}.value.type`).to.equal(valueType);
              });
              expectPath(cst, '0.whitespaceStart').to.equal(null);
              expectPath(cst, '0.whitespaceEnd').to.equal('-');
            }
          },
        );
      });

      it('correctly parses whitespace stripping character as part of LiquidTag and not the variable name', () => {
        for (const { toCST, expectPath } of testCases) {
          cst = toCST(`{%echo somevarname-%}`);
          expectPath(cst, '0.type').to.equal('LiquidTag');
          expectPath(cst, '0.whitespaceEnd').to.equal('-');
          expectPath(cst, '0.whitespaceStart').to.equal(null);
          expectPath(cst, '0.markup.type').to.equal('LiquidVariable');
          expectPath(cst, '0.markup.expression.type').to.equal('VariableLookup');
          expectPath(cst, '0.markup.expression.name').to.equal('somevarname');
          expectPath(cst, '0.markup.expression.lookups').to.eql([]);
        }
      });
    });

    describe('Case: LiquidTagOpen', () => {
      it('should parse the form tag open markup as arguments', () => {
        [
          { expression: `product`, args: [{ type: 'VariableLookup' }] },
          { expression: `"product"`, args: [{ type: 'String' }] },
        ].forEach(({ expression, args }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% form ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTagOpen');
            expectPath(cst, '0.name').to.equal('form');
            expectPath(cst, '0.markup').to.have.lengthOf(args.length, expression);
            args.forEach((arg, i) => {
              expectPath(cst, `0.markup.${i}.type`).to.equal(arg.type);
            });
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
          }
        });
      });

      it('should parse the for and tablerow tags open markup as ForMarkup', () => {
        ['for', 'tablerow'].forEach((tagName) => {
          [
            {
              expression: `product in all_products`,
              variableName: 'product',
              collection: { type: 'VariableLookup' },
              reversed: null,
              args: [],
            },
            {
              expression: `i in (0..x)`,
              variableName: 'i',
              collection: { type: 'Range' },
              reversed: null,
              args: [],
            },
            {
              expression: `product in all_products reversed`,
              variableName: 'product',
              collection: { type: 'VariableLookup' },
              reversed: 'reversed',
              args: [],
            },
            {
              expression: `product in all_products limit: 10`,
              variableName: 'product',
              collection: { type: 'VariableLookup' },
              reversed: null,
              args: [{ type: 'NamedArgument', name: 'limit', value: { type: 'Number' } }],
            },
            {
              expression: `product in all_products reversed limit: 10 offset:var`,
              variableName: 'product',
              collection: { type: 'VariableLookup' },
              reversed: 'reversed',
              args: [
                { type: 'NamedArgument', name: 'limit', value: { type: 'Number' } },
                { type: 'NamedArgument', name: 'offset', value: { type: 'VariableLookup' } },
              ],
            },
          ].forEach(({ expression, variableName, collection, reversed, args }) => {
            for (const { toCST, expectPath } of testCases) {
              cst = toCST(`{% ${tagName} ${expression} -%}`);
              expectPath(cst, '0.type').to.equal('LiquidTagOpen');
              expectPath(cst, '0.name').to.equal(tagName);
              expectPath(cst, '0.markup.type').to.equal('ForMarkup');
              expectPath(cst, '0.markup.variableName').to.equal(variableName);
              expectPath(cst, '0.markup.collection.type').to.equal(collection.type);
              expectPath(cst, '0.markup.reversed').to.equal(reversed);
              expectPath(cst, '0.markup.args').to.have.lengthOf(args.length);
              args.forEach((arg, i) => {
                expectPath(cst, `0.markup.args.${i}.type`).to.equal(arg.type);
                expectPath(cst, `0.markup.args.${i}.name`).to.equal(arg.name);
                expectPath(cst, `0.markup.args.${i}.value.type`).to.equal(arg.value.type);
              });
              expectPath(cst, '0.whitespaceEnd').to.equal('-');
            }
          });
        });
      });

      it('should parse case arguments as a singular liquid expression', () => {
        [
          { expression: `"string"`, type: 'String' },
          { expression: `var.lookup`, type: 'VariableLookup' },
        ].forEach(({ expression, type }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% case ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTagOpen');
            expectPath(cst, '0.name').to.equal('case');
            expectPath(cst, '0.markup.type').to.equal(type);
          }
        });
      });

      it('should parse capture arguments as a singular liquid variable lookup', () => {
        [{ expression: `var`, type: 'VariableLookup' }].forEach(({ expression, type }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% capture ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTagOpen');
            expectPath(cst, '0.name').to.equal('capture');
            expectPath(cst, '0.markup.type').to.equal(type);
          }
        });
      });

      it('should parse when arguments as an array of liquid expressions', () => {
        [
          { expression: `"string"`, args: [{ type: 'String' }] },
          {
            expression: `"string", var.lookup`,
            args: [{ type: 'String' }, { type: 'VariableLookup' }],
          },
          {
            expression: `"string" or var.lookup`,
            args: [{ type: 'String' }, { type: 'VariableLookup' }],
          },
        ].forEach(({ expression, args }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% when ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTag');
            expectPath(cst, '0.name').to.equal('when');
            expectPath(cst, '0.markup').to.have.lengthOf(args.length);
            args.forEach((arg, i) => {
              expectPath(cst, `0.markup.${i}.type`).to.equal(arg.type);
            });
          }
        });
      });

      it('should parse the paginate tag open markup as arguments', () => {
        [
          {
            expression: `collection.products by 50`,
            collection: { type: 'VariableLookup' },
            pageSize: { type: 'Number' },
          },
          {
            expression: `collection.products by setting.value`,
            collection: { type: 'VariableLookup' },
            pageSize: { type: 'VariableLookup' },
          },
          {
            expression: `collection.products by setting.value window_size: 2`,
            collection: { type: 'VariableLookup' },
            pageSize: { type: 'VariableLookup' },
            args: [{ type: 'Number' }],
          },
          {
            expression: `collection.products by setting.value, window_size: 2`,
            collection: { type: 'VariableLookup' },
            pageSize: { type: 'VariableLookup' },
            args: [{ type: 'Number' }],
          },
        ].forEach(({ expression, collection, pageSize, args }) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% paginate ${expression} -%}`);
            expectPath(cst, '0.type').to.equal('LiquidTagOpen');
            expectPath(cst, '0.name').to.equal('paginate');
            expectPath(cst, '0.markup.type').to.equal('PaginateMarkup');
            expectPath(cst, '0.markup.collection.type').to.equal(collection.type);
            expectPath(cst, '0.markup.pageSize.type').to.equal(pageSize.type);
            if (args) {
              expectPath(cst, '0.markup.args').to.have.lengthOf(args.length);
              args.forEach((arg, i) => {
                expectPath(cst, `0.markup.args.${i}.type`).to.equal('NamedArgument');
                expectPath(cst, `0.markup.args.${i}.value.type`).to.equal(arg.type);
              });
            } else {
              expectPath(cst, '0.markup.args').to.have.lengthOf(0);
            }
          }
        });
      });

      it('should parse the if, unless and elsif tag arguments as a list of conditions', () => {
        ['if', 'unless', 'elsif'].forEach((tagName) => {
          [
            {
              expression: 'a',
              conditions: [{ relation: null, conditional: { type: 'VariableLookup' } }],
            },
            {
              expression: 'a and "string"',
              conditions: [
                { relation: null, conditional: { type: 'VariableLookup' } },
                { relation: 'and', conditional: { type: 'String' } },
              ],
            },
            {
              expression: 'a and "string" or a<1',
              conditions: [
                { relation: null, conditional: { type: 'VariableLookup' } },
                { relation: 'and', conditional: { type: 'String' } },
                {
                  relation: 'or',
                  conditional: {
                    type: 'Comparison',
                    comparator: '<',
                    left: { type: 'VariableLookup' },
                    right: { type: 'Number' },
                  },
                },
              ],
            },
          ].forEach(({ expression, conditions }) => {
            for (const { toCST, expectPath } of testCases) {
              cst = toCST(`{% ${tagName} ${expression} -%}`);
              expectPath(cst, '0.type').to.equal(
                tagName === 'elsif' ? 'LiquidTag' : 'LiquidTagOpen',
              );
              expectPath(cst, '0.name').to.equal(tagName);
              expectPath(cst, '0.markup').to.have.lengthOf(conditions.length);
              conditions.forEach(({ relation, conditional }, i) => {
                expectPath(cst, `0.markup.${i}.type`).to.equal('Condition');
                expectPath(cst, `0.markup.${i}.relation`).to.equal(relation);
                expectPath(cst, `0.markup.${i}.expression.type`).to.equal(conditional.type);
                if (conditional.type === 'Comparison') {
                  expectPath(cst, `0.markup.${i}.expression.comparator`).to.equal(
                    conditional.comparator,
                  );
                  expectPath(cst, `0.markup.${i}.expression.left.type`).to.equal(
                    conditional?.left?.type,
                  );
                  expectPath(cst, `0.markup.${i}.expression.right.type`).to.equal(
                    conditional?.right?.type,
                  );
                }
              });
            }
          });
        });
      });
    });

    describe('Case: LiquidNode', () => {
      it('should parse raw tags', () => {
        ['style', 'raw'].forEach((raw) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% ${raw} -%}<div>{%- end${raw} %}`);
            expectPath(cst, '0.type').to.equal('LiquidRawTag');
            expectPath(cst, '0.body').to.equal('<div>');
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
            expectPath(cst, '0.delimiterWhitespaceStart').to.equal('-');
            expectPath(cst, '0.delimiterWhitespaceEnd').to.equal(null);
          }
        });
      });

      it('should parse raw tag children', () => {
        ['style', 'javascript'].forEach((raw) => {
          for (const { toCST, expectPath } of testCases) {
            const sourceCode = `
              {% ${raw} -%}
                {% liquid
                  assign x = 10
                  assign y = 11
                %}
              {%- end${raw} %}
            `;
            cst = toCST(sourceCode);
            expectPath(cst, '0.type').to.equal('LiquidRawTag');
            expectPath(cst, '0.body').toEqual(expect.stringContaining('{% liquid'));
            expectPath(cst, '0.body').toEqual(expect.stringContaining('assign x = 10'));
            expectPath(cst, '0.body').toEqual(expect.stringContaining('assign y = 11'));
            expectPath(cst, '0.children.0.type').to.equal('LiquidTag');
            const liquidTag = (cst as any)[0].children[0] as ConcreteLiquidTagLiquid;
            expect(liquidTag.name).toEqual('liquid');
            const assign1 = liquidTag.markup[0];
            const assign2 = liquidTag.markup[1];
            expect(assign1.source.slice(assign1.locStart, assign1.locEnd)).toEqual('assign x = 10');
            expect(assign2.source.slice(assign2.locStart, assign2.locEnd)).toEqual('assign y = 11');
          }
        });
      });

      it('should not parse liquid raw tag children as one big text node', () => {
        for (const { toCST, expectPath } of testCases) {
          const sourceCode = `
          {% raw -%}
            {% if unclosed %}
              not a problem
          {%- endraw %}
        `;
          cst = toCST(sourceCode);
          expectPath(cst, '0.type').to.equal('LiquidRawTag');
          expectPath(cst, '0.children').to.have.lengthOf(1);
          expectPath(cst, '0.children.0.type').toEqual('TextNode');
          expectPath(cst, '0.children.0.value').toEqual(
            expect.stringContaining('{% if unclosed %}'),
          );
          expectPath(cst, '0.children.0.value').toEqual(expect.stringContaining('not a problem'));
        }
      });

      it('should properly return block{Start,End}Loc{Start,End} locations of raw tags', () => {
        for (const { toCST, expectPath } of testCases) {
          const source = '{% raw -%}<div>{%- endraw %}';
          cst = toCST(source);
          expectPath(cst, '0.type').to.equal('LiquidRawTag');
          expectPath(cst, '0.body').to.equal('<div>');
          expectPath(cst, '0.blockStartLocStart').to.equal(0);
          expectPath(cst, '0.blockStartLocEnd').to.equal(source.indexOf('<'));
          expectPath(cst, '0.blockEndLocStart').to.equal(source.indexOf('>') + 1);
          expectPath(cst, '0.blockEndLocEnd').to.equal(source.length);
          expectPath(cst, '0.delimiterWhitespaceStart').to.equal('-');
          expectPath(cst, '0.delimiterWhitespaceEnd').to.equal(null);
        }
      });

      it('should basically parse liquid tags', () => {
        for (const { toCST, expectPath } of testCases) {
          cst = toCST('{%   unknown x = 1 %}{% if hi -%}{%- endif %}');
          expectPath(cst, '0.type').to.equal('LiquidTag');
          expectPath(cst, '0.name').to.equal('unknown');
          expectPath(cst, '0.markup').to.equal('x = 1');
          expectPath(cst, '0.whitespaceStart').to.equal(null);
          expectPath(cst, '0.whitespaceEnd').to.equal(null);
          expectPath(cst, '1.type').to.equal('LiquidTagOpen');
          expectPath(cst, '1.name').to.equal('if');
          expectPath(cst, '1.whitespaceStart').to.equal(null);
          expectPath(cst, '1.whitespaceEnd').to.equal('-');
          expectPath(cst, '2.type').to.equal('LiquidTagClose');
          expectPath(cst, '2.name').to.equal('if');
          expectPath(cst, '2.whitespaceStart').to.equal('-');
          expectPath(cst, '2.whitespaceEnd').to.equal(null);
        }
      });

      it('should support nested comments', () => {
        for (const { toCST, expectPath } of testCases) {
          const testStr =
            '{% comment -%} ho {% comment %} ho {% endcomment %} ho {%- endcomment %}';
          cst = toCST(testStr);
          expectPath(cst, '0.type').to.equal('LiquidRawTag');
          expectPath(cst, '0.name').to.equal('comment');
          expectPath(cst, '0.body').to.equal(' ho {% comment %} ho {% endcomment %} ho ');
          expectPath(cst, '0.whitespaceStart').to.equal('');
          expectPath(cst, '0.whitespaceEnd').to.equal('-');
          expectPath(cst, '0.delimiterWhitespaceStart').to.equal('-');
          expectPath(cst, '0.delimiterWhitespaceEnd').to.equal('');
          expectPath(cst, '0.blockStartLocStart').to.equal(0);
          expectPath(cst, '0.blockStartLocEnd').to.equal(0 + '{% comment -%}'.length);
          expectPath(cst, '0.blockEndLocStart').to.equal(
            testStr.length - '{%- endcomment %}'.length,
          );
          expectPath(cst, '0.blockEndLocEnd').to.equal(testStr.length);
        }
      });

      it('should parse tag open / close', () => {
        BLOCKS.forEach((block: string) => {
          for (const { toCST, expectPath } of testCases) {
            cst = toCST(`{% ${block} args -%}{%- end${block} %}`);
            expectPath(cst, '0.type').to.equal('LiquidTagOpen', block);
            expectPath(cst, '0.name').to.equal(block);
            expectPath(cst, '0.whitespaceStart').to.equal(null);
            expectPath(cst, '0.whitespaceEnd').to.equal('-');
            if (!NamedTags.hasOwnProperty(block)) {
              expectPath(cst, '0.markup').to.equal('args');
            }
            expectPath(cst, '1.type').to.equal('LiquidTagClose');
            expectPath(cst, '1.name').to.equal(block);
            expectPath(cst, '1.whitespaceStart').to.equal('-');
            expectPath(cst, '1.whitespaceEnd').to.equal(null);
          }
        });
      });
    });
  });

  describe('Unit: toLiquidHtmlCST(text)', () => {
    let cst: LiquidHtmlCST;
    const expectPath = makeExpectPath('toLiquidHtmlCST');

    describe('Case: HtmlDoctype', () => {
      it('should basically parse html doctypes', () => {
        [
          { text: '<!doctype html>', legacyDoctypeString: null },
          { text: '<!doctype html >', legacyDoctypeString: null },
          {
            text: `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN"
             "http://www.w3.org/TR/html4/frameset.dtd">`,
            legacyDoctypeString: `PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN"
             "http://www.w3.org/TR/html4/frameset.dtd"`,
          },
        ].forEach(({ text, legacyDoctypeString }) => {
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '0.type').to.equal('HtmlDoctype');
          expectPath(cst, '0.legacyDoctypeString').to.equal(legacyDoctypeString);
        });
      });
    });

    describe('Case: HtmlComment', () => {
      it('should basically parse html comments', () => {
        ['<!-- hello world -->'].forEach((text) => {
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '0.type').to.equal('HtmlComment');
          expectPath(cst, '0.body').to.equal('hello world');
        });
      });
    });

    describe('Case: HtmlNode', () => {
      it('should basically parse open and close tags', () => {
        ['<div></div>', '<div ></div >'].forEach((text) => {
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '0.type').to.eql('HtmlTagOpen');
          expectPath(cst, '0.name.0.value').to.eql('div');
          expectPath(cst, '1.type').to.eql('HtmlTagClose');
          expectPath(cst, '1.name.0.value').to.eql('div');
        });
      });

      it('should parse compound tag names', () => {
        cst = toLiquidHtmlCST('<{{header_type}}--header></{{header_type}}--header>');
        expectPath(cst, '0.type').to.eql('HtmlTagOpen');
        expectPath(cst, '0.name.0.type').to.eql('LiquidVariableOutput');
        expectPath(cst, '0.name.0.markup.type').to.eql('LiquidVariable');
        expectPath(cst, '0.name.0.markup.rawSource').to.eql('header_type');
        expectPath(cst, '0.name.1.value').to.eql('--header');
        expectPath(cst, '1.type').to.eql('HtmlTagClose');
        expectPath(cst, '1.name.0.type').to.eql('LiquidVariableOutput');
        expectPath(cst, '1.name.0.markup.type').to.eql('LiquidVariable');
        expectPath(cst, '0.name.0.markup.rawSource').to.eql('header_type');
        expectPath(cst, '1.name.1.value').to.eql('--header');

        cst = toLiquidHtmlCST('<header--{{header_type}} ></header--{{header_type}} >');
        expectPath(cst, '0.type').to.eql('HtmlTagOpen');
        expectPath(cst, '0.name.0.type').to.eql('TextNode');
        expectPath(cst, '0.name.0.value').to.eql('header--');
        expectPath(cst, '0.name.1.type').to.eql('LiquidVariableOutput');
        expectPath(cst, '0.name.1.markup.type').to.eql('LiquidVariable');
        expectPath(cst, '0.name.1.markup.rawSource').to.eql('header_type');
        expectPath(cst, '1.type').to.eql('HtmlTagClose');
        expectPath(cst, '1.name.0.type').to.eql('TextNode');
        expectPath(cst, '1.name.0.value').to.eql('header--');
        expectPath(cst, '1.name.1.type').to.eql('LiquidVariableOutput');
        expectPath(cst, '1.name.1.markup.type').to.eql('LiquidVariable');
        expectPath(cst, '0.name.1.markup.rawSource').to.eql('header_type');
      });

      it('should parse liquid variable output tag names', () => {
        cst = toLiquidHtmlCST('<{{ node_type }}></{{ node_type }}>');
        expectPath(cst, '0.type').to.equal('HtmlTagOpen');
        expectPath(cst, '0.name.0.type').to.equal('LiquidVariableOutput');
        expectPath(cst, '0.name.0.markup.type').to.equal('LiquidVariable');
        expectPath(cst, '0.name.0.markup.expression.type').to.equal('VariableLookup');
        expectPath(cst, '0.name.0.markup.expression.name').to.equal('node_type');
        expectPath(cst, '1.type').to.equal('HtmlTagClose');
        expectPath(cst, '1.name.0.type').to.equal('LiquidVariableOutput');
        expectPath(cst, '1.name.0.markup.type').to.equal('LiquidVariable');
        expectPath(cst, '1.name.0.markup.expression.type').to.equal('VariableLookup');
        expectPath(cst, '1.name.0.markup.expression.name').to.equal('node_type');
      });

      it('should parse script and style tags as a dump', () => {
        cst = toLiquidHtmlCST(
          '<script>\nconst a = {{ product | json }}\n</script><style>\n#id {}\n</style>',
        );
        expectPath(cst, '0.type').to.eql('HtmlRawTag');
        expectPath(cst, '0.name').to.eql('script');
        expectPath(cst, '0.body').to.eql('\nconst a = {{ product | json }}\n');
        expectPath(cst, '1.type').to.eql('HtmlRawTag');
        expectPath(cst, '1.name').to.eql('style');
        expectPath(cst, '1.body').to.eql('\n#id {}\n');
      });

      it('should parse script and style tags raw markup children', () => {
        ['style', 'script'].forEach((raw) => {
          const sourceCode = `
            <${raw}>
              {% liquid
                assign x = 10
                assign y = 11
              %}
            </${raw}>
          `;
          cst = toLiquidHtmlCST(sourceCode);
          expectPath(cst, '0.type').to.equal('HtmlRawTag');
          expectPath(cst, '0.body').toEqual(expect.stringContaining('{% liquid'));
          expectPath(cst, '0.body').toEqual(expect.stringContaining('assign x = 10'));
          expectPath(cst, '0.body').toEqual(expect.stringContaining('assign y = 11'));
          expectPath(cst, '0.children.0.type').to.equal('LiquidTag');
          const liquidTag = (cst as any)[0].children[0] as ConcreteLiquidTagLiquid;
          expect(liquidTag.name).toEqual('liquid');
          const liquidTagSource = liquidTag.source.slice(liquidTag.locStart, liquidTag.locEnd);
          expect(liquidTagSource.startsWith('{% liquid')).to.be.true;
          expect(liquidTagSource.endsWith('%}')).to.be.true;
          const assign1 = liquidTag.markup[0];
          const assign2 = liquidTag.markup[1];
          expect(assign1.source.slice(assign1.locStart, assign1.locEnd)).toEqual('assign x = 10');
          expect(assign2.source.slice(assign2.locStart, assign2.locEnd)).toEqual('assign y = 11');
        });
      });

      it('should parse nested svg tags as a dump', () => {
        const parts = ['<svg disabled a=1>', '<svg><path d=1></svg>', '</svg>'];
        cst = toLiquidHtmlCST(parts.join(''));
        expectPath(cst, '0.type').to.eql('HtmlRawTag');
        expectPath(cst, '0.name').to.eql('svg');
        expectPath(cst, '0.body').to.eql('<svg><path d=1></svg>');
        expectPath(cst, '0.attrList.0.name.0.type').to.eql('TextNode');
        expectPath(cst, '0.attrList.0.name.0.value').to.eql('disabled');
        expectPath(cst, '0.locStart').to.eql(0);
        expectPath(cst, '0.locEnd').to.eql(parts[0].length + parts[1].length + parts[2].length);
        expectPath(cst, '0.blockStartLocStart').to.eql(0);
        expectPath(cst, '0.blockStartLocEnd').to.eql(parts[0].length);
        expectPath(cst, '0.blockEndLocStart').to.eql(parts[0].length + parts[1].length);
        expectPath(cst, '0.blockEndLocEnd').to.eql(
          parts[0].length + parts[1].length + parts[2].length,
        );
      });

      it('should properly return block{Start,End}Loc{Start,End} locations of raw tags', () => {
        const source = '<script>const a = {{ product | json }}</script>';
        cst = toLiquidHtmlCST(source);
        expectPath(cst, '0.type').to.equal('HtmlRawTag');
        expectPath(cst, '0.blockStartLocStart').to.equal(0);
        expectPath(cst, '0.blockStartLocEnd').to.equal(source.indexOf('const'));
        expectPath(cst, '0.blockEndLocStart').to.equal(source.indexOf('</script>'));
        expectPath(cst, '0.blockEndLocEnd').to.equal(source.length);
      });

      it('should parse void elements', () => {
        VOID_ELEMENTS.forEach((voidElementName: any) => {
          cst = toLiquidHtmlCST(`<${voidElementName} disabled>`);
          expectPath(cst, '0.type').to.equal('HtmlVoidElement');
          expectPath(cst, '0.name').to.equal(voidElementName);
          expectPath(cst, '0.attrList.0.name.0.type').to.eql('TextNode');
          expectPath(cst, '0.attrList.0.name.0.value').to.eql('disabled');
        });
      });

      it('should parse empty attributes', () => {
        ['<div empty>', '<div empty >', '<div\nempty\n>'].forEach((text) => {
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '0.attrList.0.type').to.equal('AttrEmpty');
          expectPath(cst, '0.attrList.0.name.0.value').to.eql('empty');
          expectPath(cst, '0.name.attrList.0.value').to.be.undefined;
        });
      });

      it('should parse liquid attribute names', () => {
        cst = toLiquidHtmlCST('<img {{ data-name }}="{{ data-value }}"/>');
        expectPath(cst, '0.name').to.equal('img');
        expectPath(cst, '0.type').to.equal('HtmlVoidElement');
        expectPath(cst, '0.attrList.0.type').to.equal('AttrDoubleQuoted');
        expectPath(cst, '0.attrList.0.name.0.type').to.equal('LiquidVariableOutput');
        expectPath(cst, '0.attrList.0.name.0.markup.expression.type').to.equal('VariableLookup');
        expectPath(cst, '0.attrList.0.name.0.markup.expression.name').to.equal('data-name');
        expectPath(cst, '0.attrList.0.value.0.type').to.equal('LiquidVariableOutput');
        expectPath(cst, '0.attrList.0.value.0.markup.expression.type').to.equal('VariableLookup');
        expectPath(cst, '0.attrList.0.value.0.markup.expression.name').to.equal('data-value');
      });

      it(`should parse quoted attributes`, () => {
        [
          { type: 'AttrSingleQuoted', name: 'single', quote: "'" },
          { type: 'AttrSingleQuoted', name: 'single', quote: '‘' },
          { type: 'AttrSingleQuoted', name: 'single', quote: '’' },
          { type: 'AttrDoubleQuoted', name: 'double', quote: '"' },
          { type: 'AttrDoubleQuoted', name: 'double', quote: '“' },
          { type: 'AttrDoubleQuoted', name: 'double', quote: '”' },
          { type: 'AttrUnquoted', name: 'unquoted', quote: '' },
        ].forEach((testConfig) => {
          [
            `<div ${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote}>`,
            `<div ${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote} >`,
            `<div\n${testConfig.name}=${testConfig.quote}${testConfig.name}${testConfig.quote}\n>`,
          ].forEach((text) => {
            cst = toLiquidHtmlCST(text);
            expectPath(cst, '0.attrList.0.type').to.equal(testConfig.type);
            expectPath(cst, '0.attrList.0.name.0.value').to.eql(testConfig.name);
            expectPath(cst, '0.attrList.0.value.0.type').to.eql('TextNode');
            expectPath(cst, '0.attrList.0.value.0.value').to.eql(testConfig.name);
          });

          // `should accept liquid nodes inside ${testConfig.type}`
          if (testConfig.name != 'unquoted') {
            [
              `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}>`,
              `<div ${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote} >`,
              `<div\n${testConfig.name}=${testConfig.quote}https://{{ name }}${testConfig.quote}\n>`,
            ].forEach((text) => {
              cst = toLiquidHtmlCST(text);
              expectPath(cst, '0.attrList.0.value.1.type').to.eql('LiquidVariableOutput', text);
            });
          }

          // `should accept top level liquid nodes that contain ${testConfig.type}`
          [
            `<div {% if A %}${testConfig.name}=${testConfig.quote}https://name${testConfig.quote}{% endif %}>`,
            `<div {% if A %} ${testConfig.name}=${testConfig.quote}https://name${testConfig.quote} {% endif %}>`,
            `<div\n{% if A %}\n${testConfig.name}=${testConfig.quote}https://name${testConfig.quote}\n{% endif %}>`,
          ].forEach((text) => {
            cst = toLiquidHtmlCST(text);
            expectPath(cst, '0.attrList.0.type').to.eql('LiquidTagOpen', text);
            expectPath(cst, '0.attrList.1.type').to.eql(testConfig.type, text);
            expectPath(cst, '0.attrList.1.value.0.value').to.eql('https://name');
            expectPath(cst, '0.attrList.2.type').to.eql('LiquidTagClose', text);
          });
        });
      });
    });

    describe('Case: TextNode', () => {
      it('should parse text nodes', () => {
        ['<div>hello</div>', '{% if condition %}hello{% endif %}'].forEach((text) => {
          cst = toLiquidHtmlCST(text);
          expectPath(cst, '1.type').to.equal('TextNode');
          expectPath(cst, '1.value').to.equal('hello');
        });
      });

      it('should trim whitespace left and right', () => {
        [
          {
            testCase: '<div>  \n hello  world  </div>',
            expected: 'hello  world',
          },
          { testCase: '<div>  \n bb  </div>', expected: 'bb' },
          { testCase: '<div>  \n b  </div>', expected: 'b' },
          {
            testCase: '{% if a %}  \n hello  world  {% endif %}',
            expected: 'hello  world',
          },
          { testCase: '{% if a %}  \n bb  {% endif %}', expected: 'bb' },
          { testCase: '{% if a %}  \n b  {% endif %}', expected: 'b' },
        ].forEach(({ testCase, expected }) => {
          cst = toLiquidHtmlCST(testCase);
          expectPath(cst, '1.type').to.equal('TextNode');
          expectPathStringified(cst, '1.value').to.equal(JSON.stringify(expected));
        });
      });
    });

    it('should throw when trying to parse unparseable code', () => {
      const testCases = ['{% 10293 %}', '<h=>', '{% if', '{{ n', '<div>{{ n{% if'];
      for (const testCase of testCases) {
        try {
          toLiquidHtmlCST(testCase);
          expect(true, `expected ${testCase} to throw LiquidHTMLCSTParsingError`).to.be.false;
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
          expect(e.loc, `expected ${e} to have location information`).not.to.be.undefined;
        }
      }
    });

    it('should parse inline comments', () => {
      cst = toLiquidHtmlCST('{% # hello world \n # hi %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.name').to.eql('#');
      expectPath(cst, '0.markup').to.eql('hello world \n # hi');
    });
  });

  describe('Unit: toLiquidCST(text)', () => {
    let cst: LiquidHtmlCST;
    let expectPath = makeExpectPath('toLiquidCST(text)');

    it('should not throw when trying to parse unparseable code', () => {
      cst = toLiquidCST(`
        {%- liquid
          assign var1 = product
        -%}
        <table>
          {% tablerow var2 in collections.first.products %}
            {% assign var3 = var2 %}
            {{ var3.title }}
      `);

      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.name').to.eql('liquid');
      expectPath(cst, '1.type').to.eql('TextNode');
      expectPath(cst, '1.value').to.eql('<table>');
      expectPath(cst, '2.type').to.eql('LiquidTagOpen');
      expectPath(cst, '2.name').to.eql('tablerow');
      expectPath(cst, '3.type').to.eql('LiquidTag');
      expectPath(cst, '3.name').to.eql('assign');
    });

    it('should parse inline comments', () => {
      cst = toLiquidCST('{% # hello world \n # hi %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.name').to.eql('#');
      expectPath(cst, '0.markup').to.eql('hello world \n # hi');
    });
  });

  describe('Unit: toLiquidHtmlCST(text, { mode: "completion" })', () => {
    let expectPath = makeExpectPath('LiquidHtmlCST');
    let cst: LiquidHtmlCST;
    it('should parse special placeholder characters', () => {
      const toCST = (source: string) => toLiquidHtmlCST(source, { mode: 'completion' });
      cst = toCST('{% █ %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.name').to.eql('█');

      cst = toCST('{{ █ }}');
      expectPath(cst, '0.type').to.eql('LiquidVariableOutput');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.expression.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.expression.name').to.eql('█');

      cst = toCST('{{ var.█ }}');
      expectPath(cst, '0.type').to.eql('LiquidVariableOutput');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.expression.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.expression.lookups.0.type').to.eql('String');
      expectPath(cst, '0.markup.expression.lookups.0.value').to.eql('█');

      cst = toCST('{{ var[█] }}');
      expectPath(cst, '0.type').to.eql('LiquidVariableOutput');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.expression.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.expression.lookups.0.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.expression.lookups.0.name').to.eql('█');

      cst = toCST('{% echo █ %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.expression.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.expression.name').to.eql('█');

      cst = toCST('{% echo var | █ %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.filters.0.type').to.eql('LiquidFilter');
      expectPath(cst, '0.markup.filters.0.name').to.eql('█');

      cst = toCST('{% echo var | replace: █ %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.filters.0.type').to.eql('LiquidFilter');
      expectPath(cst, '0.markup.filters.0.args.0.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.filters.0.args.0.name').to.eql('█');

      cst = toCST('{% echo var | replace: "foo", █ %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.filters.0.type').to.eql('LiquidFilter');
      expectPath(cst, '0.markup.filters.0.args.1.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.filters.0.args.1.name').to.eql('█');

      cst = toCST('{% echo var | replace: "foo", var: █ %}');
      expectPath(cst, '0.type').to.eql('LiquidTag');
      expectPath(cst, '0.markup.type').to.eql('LiquidVariable');
      expectPath(cst, '0.markup.filters.0.type').to.eql('LiquidFilter');
      expectPath(cst, '0.markup.filters.0.args.1.type').to.eql('NamedArgument');
      expectPath(cst, '0.markup.filters.0.args.1.value.type').to.eql('VariableLookup');
      expectPath(cst, '0.markup.filters.0.args.1.value.name').to.eql('█');
    });
  });

  function makeExpectPath(message: string) {
    return function expectPath(cst: LiquidHtmlCST, path: string) {
      return expect(deepGet(path.split('.'), cst), message);
    };
  }

  function expectPathStringified(cst: LiquidHtmlCST, path: string) {
    return expect(JSON.stringify(deepGet(path.split('.'), cst)));
  }
});
