import { describe, it, expect } from 'vitest';
import { DeprecatedFontsOnSettingsSchema } from './index';
import { runJSONCheck } from '../../test';

describe('Module: DeprecatedFontsOnSettingsSchema', () => {
  it('reports a warning when settings_schema.json has a deprecated font', async () => {
    const sourceCode = `[
      {
        "name": "Fonts",
        "settings": [
          {
            "type": "font_picker",
            "id": "heading_font",
            "label": "Heading font",
            "default": "helvetica_n4"
          }
        ]
      }
    ]`;

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsSchema,
      sourceCode,
      'config/settings_schema.json',
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('The font "helvetica_n4" is deprecated');
  });

  it('reports no warning when settings_schema.json has non-deprecated fonts', async () => {
    const sourceCode = `[
      {
        "name": "Fonts",
        "settings": [
          {
            "type": "font_picker",
            "id": "heading_font",
            "label": "Heading font",
            "default": "alegreya_n4"
          }
        ]
      }
    ]`;

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsSchema,
      sourceCode,
      'config/settings_schema.json',
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports no warning for non-font_picker settings', async () => {
    const sourceCode = `[
      {
        "name": "Fonts",
        "settings": [
          {
            "type": "text",
            "id": "heading_text",
            "label": "Heading text",
            "default": "helvetica_n4"
          }
        ]
      }
    ]`;

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsSchema,
      sourceCode,
      'config/settings_schema.json',
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not run check on files other than settings_schema.json', async () => {
    const sourceCode = `[
      {
        "name": "Fonts",
        "settings": [
          {
            "type": "font_picker",
            "id": "heading_font",
            "label": "Heading font",
            "default": "helvetica_n4"
          }
        ]
      }
    ]`;

    const offenses = await runJSONCheck(
      DeprecatedFontsOnSettingsSchema,
      sourceCode,
      'config/other_file.json',
    );

    expect(offenses).toHaveLength(0);
  });
});
