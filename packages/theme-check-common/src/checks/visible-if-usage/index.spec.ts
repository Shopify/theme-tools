import { expect, describe, it } from 'vitest';
import { check } from '../../test';
import { ValidVisibleIf, ValidVisibleIfSettingsSchema } from './index';

type ThemeSchema = { [key: string]: unknown; settings?: Record<string, unknown>[] };
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

const checkRule = (themeData: Theme) =>
  check(makeTheme(themeData), [ValidVisibleIf, ValidVisibleIfSettingsSchema]);

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
        { type: 'text', id: 'some-global-setting' },
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

  it('reports no error for a valid reference to a global setting (in theme settings)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['config/settings_schema.json'].at(-1)!.settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ settings.some-global-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).toEqual([]);
  });

  it('reports an error for an invalid reference to a global variable (in block)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ some-nonexistent-whatever }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "some-nonexistent-whatever" was not found.',
      uri: 'file:///blocks/example.liquid',
      severity: 0,
    });
  });

  it('reports an error for an invalid reference to a block schema setting (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-nonexistent-block-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "block.settings.some-nonexistent-block-setting" was not found.',
      uri: 'file:///blocks/example.liquid',
      severity: 0,
    });
  });

  it('reports an error for an invalid reference to a block schema setting (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-nonexistent-block-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "block.settings.some-nonexistent-block-setting" was not found.',
      uri: 'file:///blocks/example.liquid',
      severity: 0,
    });
  });

  it('reports an error for an invalid reference to a section schema (simple lookup)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-nonexistent-section-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "section.settings.some-nonexistent-section-setting" was not found.',
      uri: 'file:///sections/example.liquid',
      severity: 0,
    });
  });

  it('reports an error for an invalid reference to a section schema (expression)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-nonexistent-section-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "section.settings.some-nonexistent-section-setting" was not found.',
      uri: 'file:///sections/example.liquid',
      severity: 0,
    });
  });

  it('reports an error for an invalid reference to a global setting (in theme settings)', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['config/settings_schema.json'].at(-1)!.settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ settings.some-non-existent-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "settings.some-non-existent-setting" was not found.',
      uri: 'file:///config/settings_schema.json',
      severity: 0,
    });
  });

  it('reports a detailed error when trying to use a block var in a section', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-section-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid visible_if: can\'t refer to "block" when not in a block file.',
      uri: 'file:///sections/example.liquid',
      severity: 0,
    });
  });

  it('reports a detailed error when trying to use a section var in a block', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-block-setting != "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid visible_if: can\'t refer to "section" when not in a section file.',
      uri: 'file:///blocks/example.liquid',
      severity: 0,
    });
  });

  it('reports a detailed error when trying to use a block var in theme settings', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['config/settings_schema.json'].at(-1)!.settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-block-setting }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid visible_if: can\'t refer to "block" when not in a block file.',
      uri: 'file:///config/settings_schema.json',
      severity: 0,
    });
  });

  it('reports a detailed error when attempting to use a namespace as a var', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "block.settings" refers to a namespace, but is being used here as a variable.',
      uri: 'file:///blocks/example.liquid',
      severity: 0,
    });
  });

  it('reports a detailed error when attempting to use a var as a namespace', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['blocks/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ block.settings.some-block-setting.another-thing }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid variable: "block.settings.some-block-setting" refers to a variable, but is being used here as a namespace.',
      uri: 'file:///blocks/example.liquid',
      severity: 0,
    });
  });

  it('reports visible_if fields declared with incorrect or missing brackets', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{% section.settings.some-section-setting != "null" %}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Invalid visible_if expression. It should take the form "{{ <expression> }}".',
      uri: 'file:///sections/example.liquid',
      severity: 0,
    });
  });

  it('reports malformed visible_if fields', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ section.settings.some-section-setting !r=erf "null" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'Syntax error: cannot parse visible_if expression.',
      uri: 'file:///sections/example.liquid',
      severity: 0,
    });
  });

  it('reports when no variable lookup is found', async () => {
    const themeData = structuredClone(baseThemeData);

    themeData['sections/example.liquid'].settings!.push({
      id: 'some-other-setting',
      visible_if: '{{ "some random string" }}',
    });

    const offenses = await checkRule(themeData);
    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidVisibleIf.meta.code,
      message: 'visible_if expression contains no references to any settings. This may be an error.',
      uri: 'file:///sections/example.liquid',
      severity: 0,
    });
  });
});
