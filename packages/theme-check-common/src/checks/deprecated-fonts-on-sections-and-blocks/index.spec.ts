import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck, check, MockTheme } from '../../test';
import { DeprecatedFontsOnSectionsAndBlocks } from './index';

const DEFAULT_FILE_NAME = 'sections/file.liquid';

describe('Module: DeprecatedFonts', () => {
  it('reports no warning when the setting has a non-deprecated font as default value', async () => {
    const sourceCode = `
        {% schema %}
        {
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font",
              "default": "alegreya_n4"
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when setting has a deprecated font as default value', async () => {
    const sourceCode = `
        {% schema %}
        {
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font",
              "default": "helvetica_n4"
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
  });

  it('reports a warning when multiple settings have a deprecated font as default value', async () => {
    const sourceCode = `
        {% schema %}
        {
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font",
              "default": "helvetica_n4"
            },
            {
              "type": "font_picker",
              "id": "footer_font",
              "label": "Footer font",
              "default": "helvetica_n4"
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(2);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );
    expect(offenses[1].message).toEqual(
      "setting 'footer_font' is using deprecated font 'helvetica_n4'",
    );
  });

  it('does not report a warning when the local block setting has no deprecated font', async () => {
    const sourceCode = `
        {% schema %}
        {
          "blocks": [{
            "type": "my-local-block",
            "name": "My Local Block",
            "settings": [
              {
                "type": "font_picker",
                "id": "heading_font",
                "label": "Heading font",
                "default": "alegreya_n4"
              }
            ]
          }]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the local block setting has a deprecated font', async () => {
    const sourceCode = `
        {% schema %}
        {
          "blocks": [{
            "type": "my-local-block",
            "name": "My Local Block",
            "settings": [
              {
                "type": "font_picker",
                "id": "heading_font",
                "label": "Heading font",
                "default": "helvetica_n4"
              }
            ]
          }]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
  });

  it('reports no warning when the preset settings do not use deprecated fonts', async () => {
    const sourceCode = `
        {% schema %}
        {
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font",
              "default": "alegreya_n4"
            }
          ],
          "presets": [
            {
              "name": "Preset 1",
              "settings": {
                "heading_font": "alegreya_n4"
              }
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the preset setting has a deprecated font as default value', async () => {
    const sourceCode = `
        {% schema %}
        {
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font",
              "default": "alegreya_n4"
            }
          ],
          "presets": [
            {
              "name": "Preset 1",
              "settings": {
                "heading_font": "helvetica_n4"
              }
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
  });

  it('reports no warning when the preset block setting has no deprecated fonts (blocks as a hash)', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "presets": [
            {
              "name": "Preset 1",
              "blocks": {
                "text-1": {
                    "type": "text",
                    "settings": {
                    "heading_font": "alegreya_n4"
                  }
                }
              }
            }
          ]
        }
      {% endschema %}`,
      'blocks/text.liquid': `
      {% schema %}
        {
          "name": "Text Block",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the preset block setting has a deprecated font (blocks as a hash)', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "presets": [
            {
              "name": "Preset 1",
              "blocks": {
                "text-1": {
                    "type": "text",
                    "settings": {
                    "heading_font": "helvetica_n4"
                  }
                }
              }
            }
          ]
        }
      {% endschema %}`,
      'blocks/text.liquid': `
      {% schema %}
        {
          "name": "Text Block",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );
  });

  it('reports a warning when the preset block setting has a deprecated font in a nested block (blocks as a hash)', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "presets": [
            {
              "name": "Preset 1",
              "blocks": {
                "text-1": {
                  "type": "text",
                  "blocks": {
                    "text-2": {
                      "type": "text",
                      "settings": { "heading_font": "helvetica_n4" }
                    }
                  }
                }
              }
            }
          ]
        }
      {% endschema %}`,
      'blocks/text.liquid': `
      {% schema %}
        {
          "name": "Text Block",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );
  });

  it('reports no warning when the preset block setting has no deprecated fonts (blocks as an array)', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "presets": [
            {
              "name": "Preset 1",
              "blocks": [
                {
                    "type": "text",
                    "settings": { "heading_font": "alegreya_n4" }
                }
              ]
            }
          ]
        }
      {% endschema %}`,
      'blocks/text.liquid': `
      {% schema %}
        {
          "name": "Text Block",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the preset block setting has a deprecated font (blocks as an array)', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "presets": [
            {
              "name": "Preset 1",
              "blocks": [
                {
                  "type": "text",
                  "settings": { "heading_font": "helvetica_n4" }
                }
              ]
            }
          ]
        }
      {% endschema %}`,
      'blocks/text.liquid': `
      {% schema %}
        {
          "name": "Text Block",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );
  });

  it('reports a warning when the preset nested block setting has a deprecated fonts (blocks as an array)', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "presets": [
            {
              "name": "Preset 1",
              "blocks": [
                {
                  "type": "text",
                  "blocks": [
                    {
                      "type": "text",
                      "settings": { "heading_font": "helvetica_n4" }
                    }
                  ]
                }
              ]
            }
          ]
        }
      {% endschema %}`,
      'blocks/text.liquid': `
      {% schema %}
        {
          "name": "Text Block",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );
  });

  it('reports no warning when the section default setting has no deprecated fonts', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
          "defaults": {
            "settings": {
              "heading_font": "alegreya_n4"
            }
          }
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the section default setting has a deprecated font', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": "Section 1",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
          "default": {
            "settings": {
              "heading_font": "helvetica_n4"
            }
          }
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
  });

  it('reports no warning when the section default block setting has no deprecated fonts', async () => {
    const theme: MockTheme = {
      'sections/section-1.liquid': `
      {% schema %}
        {
          "name": "Section 1",
          "settings": [
            {
              "type": "font_picker",
              "id": "heading_font",
              "label": "Heading font"
            }
          ],
          "blocks": [
            {
              "type": "text"
            }
          ],
          "defaults": {
            "blocks": {
              "type": "text",
              "settings": {
                "heading_font": "alegreya_n4"
              }
            }
          }
        }
      {% endschema %}`,
    };

    const offenses = await check(theme, [DeprecatedFontsOnSectionsAndBlocks]);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the section default block setting has a deprecated font', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": "Section 1",
          "blocks": [
            {
              "type": "text",
              "name": "Local Text Block",
              "settings": [
                {
                  "type": "font_picker",
                  "id": "heading_font",
                  "label": "Heading font"
                }
              ]
            }
          ],
          "default": {
            "blocks": [{
              "type": "text",
              "settings": {
                "heading_font": "helvetica_n4"
              }
            }]
          }
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      DeprecatedFontsOnSectionsAndBlocks,
      sourceCode,
      DEFAULT_FILE_NAME,
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "setting 'heading_font' is using deprecated font 'helvetica_n4'",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
  });
});
