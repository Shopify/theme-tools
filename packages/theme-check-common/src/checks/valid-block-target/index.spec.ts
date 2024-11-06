import { expect, describe, it } from 'vitest';
import { ValidBlockTarget } from './index';
import { check, MockTheme } from '../../test';
import { Dependencies } from '../../types';

describe('Module: ValidBlockTarget', () => {
  const mockDependencies: Partial<Dependencies> = {
    jsonValidationSet: {
      schemas: async () => [],
    },
  };

  const blocks = {
    'blocks/text.liquid': 'Text block content',
    'blocks/image.liquid': 'Image block content',
    'blocks/_private.liquid': 'Private block content',
    'blocks/_another.liquid': 'Another private block content',
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

  const invalidRootLevelSchema = {
    'sections/invalid-root-level.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "invalid_root_level_block",
            "name": "Invalid root level block"
          },
          {
            "type": "@theme",
            "name": "Theme"
          }
        ],
        "presets": [
          {
            "name": "Default preset",
            "blocks": [
              {
                "type": "text"
              }
            ]
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

  const privateBlockSchema = {
    'sections/private-blocks.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "@theme",
            "name": "Theme"
          }
        ],
        "presets": [
          {
            "name": "Default",
            "blocks": [
              {
                "type": "_private"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `,
  };

  const nestedPrivateSchema = {
    'sections/mixed-blocks.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "@theme",
            "name": "Theme"
          },
          {
            "type": "_private",
            "name": "Private"
          },
          {
            "type": "_another",
            "name": "Another Private"
          }
        ],
        "presets": [
          {
            "name": "Default",
            "blocks": [
              {
                "type": "_private"
              },
              {
                "type": "_another"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `,
  };

  const privateRootLevelSchema = {
    'sections/private-blocks.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "@theme",
            "name": "Theme"
          },
          {
            "type": "_private",
            "name": "Private"
          }
        ],
        "presets": [
          {
            "name": "Default",
            "blocks": [
              {
                "type": "_private"
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

  describe('Valid Blocks', () => {
    it('should not report any errors when all block files exist', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...validSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.be.empty;
    });

    it('should ignore @app and @theme block types', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...appThemeSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.be.empty;
    });

    it('should not report errors for private blocks when listed at root level', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...privateRootLevelSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.be.empty;
    });

    it('should handle mixed private and public blocks correctly', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...nestedPrivateSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.be.empty;
    });
  });

  describe('Invalid Blocks', () => {
    it('should report errors when root level block file does not exist', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...invalidRootLevelSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Block file 'blocks/invalid_root_level_block.liquid' does not exist",
      );
    });

    it('should report an error when a preset block file does not exist', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...invalidBlockSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Block file 'blocks/missing_block.liquid' does not exist",
      );
    });

    it('should report an error when a preset block not specified at root level', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...invalidPresetSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Preset block type 'invalid_preset_block' does not reference a valid root-level block type",
      );
    });

    it('should report errors for private blocks even without @theme', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...privateBlockSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Preset block type '_private' does not reference a valid root-level block type",
      );
    });

    it('should report errors with correct indices', async () => {
      const theme: MockTheme = {
        ...blocks,
        ...privateBlockSchema,
      };

      const offenses = await check(theme, [ValidBlockTarget], mockDependencies);
      expect(offenses).to.have.length(1);

      const startIndex = privateBlockSchema['sections/private-blocks.liquid'].indexOf('"_private"');
      expect(offenses[0].start.index).to.equal(startIndex);
      expect(offenses[0].end.index).to.equal(startIndex + '"_private"'.length);
    });
  });
});
