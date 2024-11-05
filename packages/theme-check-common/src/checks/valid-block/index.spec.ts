import { expect, describe, it } from 'vitest';
import { ValidBlock } from './index';
import { check, MockTheme } from '../../test';

describe('Module: ValidBlock', () => {
  const blocks = {
    'blocks/text.liquid': 'Text block content',
    'blocks/image.liquid': 'Image block content',
  };

  const validSchema = {
    'sections/valid.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "text",
            "name": "Text block"
          }
        ]
      }
      {% endschema %}
    `,
  };

  const invalidBlockSchema = {
    'sections/invalid-block.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "missing_block",
            "name": "Text block"
          }
        ]
      }
      {% endschema %}
    `,
  };

  const invalidPresetSchema = {
    'sections/invalid-preset.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "text",
            "name": "Text block"
          }
        ],
        "presets": [
          {
            "name": "Default preset",
            "blocks": [
              {
                "type": "invalid_preset_block"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `,
  };

  const appThemeSchema = {
    'sections/app-theme.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "@app"
          },
          {
            "type": "@theme"
          }
        ]
      }
      {% endschema %}
    `,
  };

  it('should not report any errors when all block files exist', async () => {
    const theme: MockTheme = {
      ...blocks,
      ...validSchema,
    };

    const offenses = await check(theme, [ValidBlock]);
    expect(offenses).to.be.empty;
  });

  it('should report an error when a root-level block type is invalid', async () => {
    const theme: MockTheme = {
      ...blocks,
      ...invalidBlockSchema,
    };

    const offenses = await check(theme, [ValidBlock]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("Block file 'blocks/missing_block.liquid' does not exist");
  });

  it('should report an error when a preset block type is invalid', async () => {
    const theme: MockTheme = {
      ...blocks,
      ...invalidPresetSchema,
    };

    const offenses = await check(theme, [ValidBlock]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("Block file 'blocks/invalid_preset_block.liquid' does not exist");
  }); 

  it('should ignore @app and @theme block types', async () => {
    const theme: MockTheme = {
      ...appThemeSchema,
    };

    const offenses = await check(theme, [ValidBlock]);
    expect(offenses).to.be.empty;
  });
});