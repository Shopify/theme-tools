import { describe, expect, it } from 'vitest';
import { NodeTypes, RawMarkupKinds } from '@shopify/liquid-html-parser';
import { getParser } from './embed';
import { format } from '../test/test-helpers';

const schemaJson = {
  kind: RawMarkupKinds.json,
  parentNode: { type: NodeTypes.LiquidRawTag, name: 'schema' },
} as any;

const scriptJson = {
  kind: RawMarkupKinds.json,
  parentNode: { type: NodeTypes.HtmlRawNode, name: 'script' },
} as any;

// What Prettier 3.2+ passes in options.plugins: its built-in language plugins,
// one of which has the jsonc parser.
const withJsonc = [{ parsers: { json: {}, jsonc: {} } }];
const withoutJsonc = [{ parsers: { json: {} } }];

describe('Unit: getParser', () => {
  it('uses jsonc for the schema tag when jsoncSchema is on and Prettier has the jsonc parser', () => {
    expect(getParser(schemaJson, { jsoncSchema: true, plugins: withJsonc })).toBe('jsonc');
  });

  it('uses json for the schema tag when jsoncSchema is off', () => {
    expect(getParser(schemaJson, { jsoncSchema: false, plugins: withJsonc })).toBe('json');
    expect(getParser(schemaJson, { plugins: withJsonc })).toBe('json');
  });

  it('uses json when Prettier has no jsonc parser (before 3.2)', () => {
    expect(getParser(schemaJson, { jsoncSchema: true, plugins: withoutJsonc })).toBe('json');
    expect(getParser(schemaJson, { jsoncSchema: true })).toBe('json');
  });

  it('leaves JSON outside the schema tag alone', () => {
    expect(getParser(scriptJson, { jsoncSchema: true, plugins: withJsonc })).toBe('json');
  });

  it('formats the schema tag as before when jsonc is not available', async () => {
    const input = '{% schema %}\n{"name": "Slideshow", "limit": 1,}\n{% endschema %}';
    const output = await format(input, { jsoncSchema: true, indentSchema: true });
    expect(output).toEqual(
      '{% schema %}\n  { "name": "Slideshow", "limit": 1 }\n{% endschema %}\n',
    );
  });
});
