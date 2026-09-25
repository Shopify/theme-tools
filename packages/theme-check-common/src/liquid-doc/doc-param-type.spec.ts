import { describe, expect, it } from 'vitest';
import { BasicParamTypes, parseDocParamType, parseParamType } from './utils';

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

  it('retains enum members and their literal spelling', () => {
    expect(parseDocParamType(validParamTypes, `'Heading' | "small" | '' | 'a|b' | 'a}b'`)).toEqual({
      kind: 'string-enum',
      members: [
        { value: 'Heading', raw: "'Heading'" },
        { value: 'small', raw: '"small"' },
        { value: '', raw: "''" },
        { value: 'a|b', raw: "'a|b'" },
        { value: 'a}b', raw: "'a}b'" },
      ],
    });
  });

  it('parses enums independently of the named-type catalog', () => {
    expect(parseDocParamType(new Set(), "'heading'")).toEqual({
      kind: 'string-enum',
      members: [{ value: 'heading', raw: "'heading'" }],
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
