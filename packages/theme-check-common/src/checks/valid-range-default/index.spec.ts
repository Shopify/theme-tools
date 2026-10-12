import { describe, expect, it } from 'vitest';
import { check, runJSONCheck } from '../../test';
import { ValidRangeDefault, ValidRangeDefaultSettingsSchema } from './index';

function toLiquidFile(content: unknown) {
  return `
    {% schema %}
      ${JSON.stringify(content)}
    {% endschema %}
  `;
}

describe('Module: ValidRangeDefault (Liquid schema)', () => {
  describe('setting defaults', () => {
    it('does not report when the default is aligned to the step grid', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'padding_top',
              min: 0,
              max: 160,
              step: 8,
              default: 64,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports when the default is off the step grid', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'padding_top',
              min: 0,
              max: 160,
              step: 8,
              default: 60,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/padding_top/);
      expect(offenses[0].message).toMatch(/60/);
      expect(offenses[0].message).toMatch(/step 8/);
      expect(offenses[0].message).toMatch(/try 64/);
    });

    it('reports when the default is below min', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'gap',
              min: 10,
              max: 60,
              step: 5,
              default: 0,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/outside the range \[10, 60\]/);
    });

    it('reports when the default is above max', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'gap',
              min: 0,
              max: 100,
              step: 10,
              default: 200,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/outside the range \[0, 100\]/);
    });

    it('handles fractional steps without floating-point false positives', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'rating',
              min: 1,
              max: 5,
              step: 0.1,
              default: 4.7,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports an off-step fractional default', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'gap',
              min: 0,
              max: 10,
              step: 0.5,
              default: 2.3,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/gap/);
      expect(offenses[0].message).toMatch(/step 0.5/);
    });

    it('does not report when the range setting has no default', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'padding_top',
              min: 0,
              max: 160,
              step: 8,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('skips settings missing min/max/step (let JSON schema validation handle it)', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'padding_top',
              default: 60,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('ignores non-range settings', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            { type: 'text', id: 'heading', default: 'Hello' },
            { type: 'number', id: 'count', default: 7 },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports multiple invalid range defaults in one schema', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [
            {
              type: 'range',
              id: 'padding_top',
              min: 0,
              max: 160,
              step: 8,
              default: 60,
            },
            {
              type: 'range',
              id: 'padding_bottom',
              min: 0,
              max: 160,
              step: 8,
              default: 60,
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(2);
    });
  });

  describe('preset settings', () => {
    it('does not report when a preset setting is on the step grid', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [{ type: 'range', id: 'padding_top', min: 0, max: 160, step: 8 }],
          presets: [{ name: 'Default', settings: { padding_top: 48 } }],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(0);
    });

    it('reports when a preset setting is off the step grid', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [{ type: 'range', id: 'padding_top', min: 0, max: 160, step: 8 }],
          presets: [{ name: 'Default', settings: { padding_top: 60 } }],
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/padding_top/);
      expect(offenses[0].message).toMatch(/60/);
    });

    it('reports invalid values in section default.settings', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          name: 'Example',
          settings: [{ type: 'range', id: 'padding_top', min: 0, max: 160, step: 8 }],
          default: { settings: { padding_top: 60 } },
        }),
      };

      const offenses = await check(theme, [ValidRangeDefault]);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/padding_top/);
    });
  });
});

describe('Module: ValidRangeDefaultSettingsSchema (config/settings_schema.json)', () => {
  it('reports an off-step default in config/settings_schema.json', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [
          {
            type: 'range',
            id: 'logo_width',
            min: 50,
            max: 200,
            step: 4,
            default: 75,
          },
        ],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidRangeDefaultSettingsSchema,
      source,
      'config/settings_schema.json',
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/logo_width/);
    expect(offenses[0].message).toMatch(/75/);
    expect(offenses[0].message).toMatch(/step 4/);
  });

  it('does not report a valid default', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [
          {
            type: 'range',
            id: 'logo_width',
            min: 50,
            max: 200,
            step: 4,
            default: 74,
          },
        ],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidRangeDefaultSettingsSchema,
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
            type: 'range',
            id: 'logo_width',
            min: 50,
            max: 200,
            step: 4,
            default: 75,
          },
        ],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidRangeDefaultSettingsSchema,
      source,
      'config/other.json',
    );
    expect(offenses).toHaveLength(0);
  });
});
