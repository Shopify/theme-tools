import { describe, expect, it } from 'vitest';
import { BasicParamTypes, parseDocParamType, parseParamType, parseStringLiterals } from './utils';

describe('parseDocParamType', () => {
  const validParamTypes = new Set([...Object.values(BasicParamTypes), 'product']);

  it.each([...Object.values(BasicParamTypes), 'product'])(
    'represents the named type %s',
    (name) => {
      expect(parseDocParamType(validParamTypes, name)).toEqual({ kind: 'named', name });
    },
  );

  it.each(['string', 'product'])('represents arrays of %s', (valueType) => {
    expect(parseDocParamType(validParamTypes, `${valueType}[]`)).toEqual({
      kind: 'array',
      valueType,
    });
  });

  it('represents enums as unions of string literals with their original spelling', () => {
    expect(parseDocParamType(validParamTypes, `'Heading' | "small" | '' | 'a|b' | 'a}b'`)).toEqual({
      kind: 'union',
      types: [
        { kind: 'literal', value: 'Heading', raw: "'Heading'" },
        { kind: 'literal', value: 'small', raw: '"small"' },
        { kind: 'literal', value: '', raw: "''" },
        { kind: 'literal', value: 'a|b', raw: "'a|b'" },
        { kind: 'literal', value: 'a}b', raw: "'a}b'" },
      ],
    });
  });

  it('parses string literals independently of the named-type catalog', () => {
    expect(parseDocParamType(new Set(), "'heading'")).toEqual({
      kind: 'literal',
      value: 'heading',
      raw: "'heading'",
    });
    expect(parseDocParamType(new Set(), 'product')).toBeUndefined();
  });

  it.each([
    '',
    'unknown',
    'unknown[]',
    'String',
    ' string ',
    'string[][]',
    'string | number',
    "'heading' |",
    "'heading' | number",
    "'heading'[]",
    "'heading' | 'small",
    '1 | 2',
  ])('rejects unsupported or malformed type %s', (value) => {
    expect(parseDocParamType(validParamTypes, value)).toBeUndefined();
  });

  it('preserves the legacy named-type tuple API', () => {
    expect(parseParamType(validParamTypes, 'product')).toEqual(['product', false]);
    expect(parseParamType(validParamTypes, 'product[]')).toEqual(['product', true]);
    expect(parseParamType(validParamTypes, "'heading' | 'small'")).toBeUndefined();
  });
});

describe('parseStringLiterals', () => {
  it.each([
    ["'heading' | 'small'", ['heading', 'small'], ["'heading'", "'small'"]],
    [` "Heading"|'small' `, ['Heading', 'small'], ['"Heading"', "'small'"]],
    ["'heading'", ['heading'], ["'heading'"]],
    ["'' | ' small '", ['', ' small '], ["''", "' small '"]],
    ["'a|b'\t|\t'a}b'", ['a|b', 'a}b'], ["'a|b'", "'a}b'"]],
    [`"it's" | 'say "hi"'`, ["it's", 'say "hi"'], [`"it's"`, `'say "hi"'`]],
    [String.raw`'a\nb' | 'a\'`, [String.raw`a\nb`, 'a\\'], [String.raw`'a\nb'`, "'a\\'"]],
    ["'heading' | 'heading'", ['heading', 'heading'], ["'heading'", "'heading'"]],
  ])('parses %s without changing literal values', (type, values, raw) => {
    const literals = parseStringLiterals(type as string);
    expect(literals?.map((literal) => literal.value)).toEqual(values);
    expect(literals?.map((literal) => literal.raw)).toEqual(raw);
  });

  it.each([
    '',
    ' ',
    'string',
    'product[]',
    'heading | small',
    "'heading' |",
    "'heading' | ",
    "| 'heading'",
    "'heading' || 'small'",
    "'heading' 'small'",
    "'heading' | small",
    "'heading' | 'small",
    "'heading' trailing",
    "'heading' | number",
    '1 | 2',
    'true | false',
    "('heading' | 'small')",
    "'heading'[]",
    "'heading' |\n'small'",
    "'heading\rsmall'",
    String.raw`'it\'s'`,
  ])('rejects the entire invalid annotation %s', (type) => {
    expect(parseStringLiterals(type)).toBeUndefined();
  });
});
