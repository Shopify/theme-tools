import { expect, describe, it } from 'vitest';
import { check } from '../../test';
import { ValidVisibleIf } from './index';

type ThemeSetting = Record<string, unknown>;
type ThemeSchema = { [key: string]: unknown; settings?: ThemeSetting[] };
type Theme = { [key: `${string}.json`]: ThemeSchema[]; [key: `${string}.liquid`]: ThemeSchema };

const toLiquid = (schema: unknown) => `
  {% schema %}
    ${JSON.stringify(schema, undefined, 2)}
  {% endschema %}
`;

const makeTheme = (themeData: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(themeData).map(([key, value]) => [
      key,
      key.endsWith('.json') ? JSON.stringify(value, undefined, 2) : toLiquid(value),
    ]),
  );

const checkRule = (themeData: Theme) => check(makeTheme(themeData), [ValidVisibleIf]);

const baseThemeData: Theme = {
  'sections/example.liquid': {
    name: 'My Section',
    settings: [{ id: 'some-section-setting' }],
  },
  'blocks/example.liquid': {
    name: 'My Block',
    settings: [{ id: 'some-block-setting' }],
  },
  'config/settings_schema.json': [
    {
      name: 'theme_info',
      theme_name: 'Test Theme',
      theme_version: '0.1.0',
      theme_author: 'Shopify',
    },
    {
      name: 't:some.namespace',
      settings: [
        { type: 'header', content: 't:some.other.namespace' },
        { id: 'some-global-setting' },
      ],
    },
  ],
};

describe('Module: ValidVisibleIf', () => {
  it('reports no error for a valid reference to a block schema setting (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-block-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports no error for a valid reference to a block schema setting (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-block-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports no error for a valid reference to a global setting (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ settings.some-global-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports no error for a valid reference to a global setting (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ "null" != settings.some-global-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports no error for a valid reference to a section schema (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-section-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports no error for a valid reference to a section schema (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-section-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports an error for an invalid reference to a global variable', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ some-nonexistent-whatever }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 49,
            "index": 195,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "some-nonexistent-whatever" was not found.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 170,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///blocks/example.liquid",
        },
      ]
    `);
  });

  it('reports an error for an invalid reference to a block schema setting (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-nonexistent-block-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 69,
            "index": 215,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "block.settings.some-nonexistent-block-setting" was not found.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 170,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///blocks/example.liquid",
        },
      ]
    `);
  });

  it('reports an error for an invalid reference to a block schema setting (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-nonexistent-block-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 69,
            "index": 215,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "block.settings.some-nonexistent-block-setting" was not found.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 170,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///blocks/example.liquid",
        },
      ]
    `);
  });

  it('reports an error for an invalid reference to a section schema (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-nonexistent-section-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 73,
            "index": 223,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "section.settings.some-nonexistent-section-setting" was not found.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 174,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///sections/example.liquid",
        },
      ]
    `);
  });

  it('reports an error for an invalid reference to a section schema (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-nonexistent-section-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 73,
            "index": 223,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "section.settings.some-nonexistent-section-setting" was not found.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 174,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///sections/example.liquid",
        },
      ]
    `);
  });

  it('reports a detailed error when trying to use a block var in a section', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-section-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 59,
            "index": 209,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid visible_if: can't refer to "block" when not in a block file.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 174,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///sections/example.liquid",
        },
      ]
    `);
  });

  it('reports a detailed error when trying to use a section var in a block', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-block-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 59,
            "index": 205,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid visible_if: can't refer to "section" when not in a section file.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 170,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///blocks/example.liquid",
        },
      ]
    `);
  });

  it('reports a detailed error when attempting to use a namespace as a var', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 38,
            "index": 184,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "block.settings" refers to a namespace, but is being used here as a variable.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 170,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///blocks/example.liquid",
        },
      ]
    `);
  });

  it('reports a detailed error when attempting to use a var as a namespace', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-block-setting.another-thing }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toMatchInlineSnapshot(`
      [
        {
          "check": "ValidVisibleIf",
          "end": {
            "character": 71,
            "index": 217,
            "line": 10,
          },
          "fix": undefined,
          "message": "Invalid variable: "block.settings.some-block-setting" refers to a variable, but is being used here as a namespace.",
          "severity": 0,
          "start": {
            "character": 24,
            "index": 170,
            "line": 10,
          },
          "suggest": undefined,
          "type": "LiquidHtml",
          "uri": "file:///blocks/example.liquid",
        },
      ]
    `);
  });
});
