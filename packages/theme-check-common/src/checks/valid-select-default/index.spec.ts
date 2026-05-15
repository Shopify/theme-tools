import { describe, expect, it } from 'vitest';
import { check, runJSONCheck } from '../../test';
import { ValidSelectDefault, ValidSelectDefaultSettingsSchema } from './index';

function toLiquidFile(content: unknown) {
  return `
    {% schema %}
      ${JSON.stringify(content)}
    {% endschema %}
  `;
}

const alignmentOptions = [
  { value: 'flex-start', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'Right' },
];

describe('Module: ValidSelectDefault (Liquid schema)', () => {
  describe('setting defaults', () => {
    it('does not report when the select default matches an option', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              default: 'center',
              options: alignmentOptions,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports when the select default is not in options', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              default: 'this-is-not-an-option',
              options: alignmentOptions,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/alignment/);
      expect(offenses[0].message).toMatch(/this-is-not-an-option/);
      expect(offenses[0].message).toMatch(/flex-start/);
    });

    it('reports when a radio default is not in options', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'radio',
              id: 'layout_direction',
              default: 'bogus',
              options: [
                { value: 'row', label: 'Row' },
                { value: 'column', label: 'Column' },
              ],
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/layout_direction/);
      expect(offenses[0].message).toMatch(/bogus/);
    });

    it('does not report when the setting has no default', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              options: alignmentOptions,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('ignores non-choice settings', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            { type: 'text', id: 'heading', default: 'anything' },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(0);
    });
  });

  describe('preset settings', () => {
    it('does not report when preset setting matches an option', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              options: alignmentOptions,
            },
          ],
          presets: [
            {
              name: 'Column',
              settings: { alignment: 'flex-end' },
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports when preset setting is not in options', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              options: alignmentOptions,
            },
          ],
          presets: [
            {
              name: 'Column',
              settings: { alignment: 'this-is-not-an-option' },
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/alignment/);
      expect(offenses[0].message).toMatch(/this-is-not-an-option/);
    });

    it('reports both invalid default and invalid preset setting', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              default: 'bad-default',
              options: alignmentOptions,
            },
          ],
          presets: [
            {
              name: 'Column',
              settings: { alignment: 'also-bad' },
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(2);
    });

    it('does not report when preset references a non-select setting', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [{ type: 'text', id: 'heading' }],
          presets: [
            {
              name: 'Column',
              settings: { heading: 'free-form text' },
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports invalid values in section default.settings', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'select',
              id: 'alignment',
              options: alignmentOptions,
            },
          ],
          default: {
            settings: { alignment: 'nope' },
          },
        }),
      };

      const offenses = await check(theme, [ValidSelectDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/alignment/);
      expect(offenses[0].message).toMatch(/nope/);
    });
  });
});

describe('Module: ValidSelectDefaultSettingsSchema (config/settings_schema.json)', () => {
  it('reports an invalid default in config/settings_schema.json', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [
          {
            type: 'select',
            id: 'alignment',
            default: 'this-is-not-an-option',
            options: alignmentOptions,
          },
        ],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidSelectDefaultSettingsSchema,
      source,
      'config/settings_schema.json',
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/alignment/);
    expect(offenses[0].message).toMatch(/this-is-not-an-option/);
  });

  it('does not report a valid default', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [
          {
            type: 'select',
            id: 'alignment',
            default: 'center',
            options: alignmentOptions,
          },
        ],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidSelectDefaultSettingsSchema,
      source,
      'config/settings_schema.json',
    );
    expect(offenses).toHaveLength(0);
  });

  it('does not run on files other than settings_schema.json', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [
          {
            type: 'select',
            id: 'alignment',
            default: 'this-is-not-an-option',
            options: alignmentOptions,
          },
        ],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidSelectDefaultSettingsSchema,
      source,
      'config/other.json',
    );
    expect(offenses).toHaveLength(0);
  });
});
