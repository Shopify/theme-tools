import { describe, expect, it } from 'vitest';
import { parseStringEnumType } from './string-enum-type';

describe('parseStringEnumType', () => {
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
    const members = parseStringEnumType(type as string);
    expect(members?.map((member) => member.value)).toEqual(values);
    expect(members?.map((member) => member.raw)).toEqual(raw);
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
    expect(parseStringEnumType(type)).toBeUndefined();
  });
});
