import { describe, expect, it } from 'vitest';
import { toJSONNode, location } from './parse';

describe('module: toJSONNode', () => {
  it('should parse basic key-value pairs', () => {
    //                      0123456789012345
    const ast = toJSONNode(`{"key": "value"}`);
    expect(ast).toEqual({
      type: 'Object',
      loc: location(0, 16),
      children: [
        {
          type: 'Property',
          loc: location(1, 15),
          key: {
            type: 'Identifier',
            value: 'key',
            raw: '"key"',
            loc: location(1, 6),
          },
          value: {
            type: 'Literal',
            value: 'value',
            raw: '"value"',
            loc: location(8, 15),
          },
        },
      ],
    });
  });

  it('should parse basic array of literals', () => {
    //                      0123456789012345678901234
    const ast = toJSONNode(`["one", true, null, 10]`);
    expect(ast).toEqual({
      type: 'Array',
      loc: location(0, 23),
      children: [
        {
          type: 'Literal',
          value: 'one',
          raw: '"one"',
          loc: location(1, 6),
        },
        {
          type: 'Literal',
          value: true,
          raw: 'true',
          loc: location(8, 12),
        },
        {
          type: 'Literal',
          value: null,
          raw: 'null',
          loc: location(14, 18),
        },
        {
          type: 'Literal',
          value: 10,
          raw: '10',
          loc: location(20, 22),
        },
      ],
    });
  });

  it('should not break on block comments', () => {
    //                      01234567890123456789012
    const ast = toJSONNode(`/** block comment */10`);
    expect(ast).toEqual({
      type: 'Literal',
      value: 10,
      raw: '10',
      loc: location(20, 22),
    });
  });

  it('should not break on line comments', () => {
    const source = `// line comment
10`;
    const ast = toJSONNode(source);
    expect(ast).toEqual({
      type: 'Literal',
      value: 10,
      raw: '10',
      loc: location(source.indexOf('10'), source.indexOf('10') + 2),
    });
  });

  it('should not break on trailing commas', () => {
    const source = `{
      "key": "value",
    }`;
    const ast = toJSONNode(source);
    expect(ast).toEqual({
      type: 'Object',
      loc: location(0, source.length),
      children: [
        {
          type: 'Property',
          loc: location(source.indexOf('"key"'), source.indexOf('"value"') + '"value"'.length),
          key: {
            type: 'Identifier',
            value: 'key',
            raw: '"key"',
            loc: expect.anything(),
          },
          value: {
            type: 'Literal',
            value: 'value',
            raw: '"value"',
            loc: expect.anything(),
          },
        },
      ],
    });
  });
});
