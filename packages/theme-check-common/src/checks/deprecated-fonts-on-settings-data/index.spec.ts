import { describe, it, expect } from 'vitest';
import { DeprecatedFontsOnSettingsData } from './index';
import { runJSONCheck } from '../../test';

describe('Module: DeprecatedFontsOnSettingsData', () => {
  it('reports a warning when settings_data.json has a deprecated font in current settings', async () => {
    const sourceCode = JSON.stringify({
      current: {
        heading_font: 'helvetica_n4',
        body_font: 'alegreya_n4',
      },
    });

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsData,
      sourceCode,
      'config/settings_data.json',
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('The font "helvetica_n4" is deprecated');
  });

  it('reports warnings for deprecated fonts in presets', async () => {
    const sourceCode = JSON.stringify({
      current: {},
      presets: {
        Default: {
          heading_font: 'helvetica_n4',
          body_font: 'agmena_n4',
        },
      },
    });

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsData,
      sourceCode,
      'config/settings_data.json',
    );

    expect(offenses).toHaveLength(2);
    expect(offenses.map((o) => o.message)).toContain('The font "helvetica_n4" is deprecated');
    expect(offenses.map((o) => o.message)).toContain('The font "agmena_n4" is deprecated');
  });

  it('reports no warning when settings_data.json has no deprecated fonts', async () => {
    const sourceCode = JSON.stringify({
      current: {
        heading_font: 'alegreya_n4',
        body_font: 'bitter_n4',
      },
    });

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsData,
      sourceCode,
      'config/settings_data.json',
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports no warning for non-string values', async () => {
    const sourceCode = JSON.stringify({
      current: {
        show_header: true,
        items_per_page: 12,
        colors_body_bg: '#ffffff',
      },
    });

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsData,
      sourceCode,
      'config/settings_data.json',
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not run check on files other than settings_data.json', async () => {
    const sourceCode = JSON.stringify({
      current: {
        heading_font: 'helvetica_n4',
      },
    });

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsData,
      sourceCode,
      'config/settings_schema.json',
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports warnings for deprecated fonts deeply nested in preset blocks', async () => {
    const sourceCode = JSON.stringify({
      current: {
        blocks: {
          'block-id-1': {
            type: 'header',
            settings: {
              heading_font: 'helvetica_n4',
            },
          },
        },
      },
    });

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsData,
      sourceCode,
      'config/settings_data.json',
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('The font "helvetica_n4" is deprecated');
  });
});
