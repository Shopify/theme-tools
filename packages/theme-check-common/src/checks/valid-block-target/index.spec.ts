import { expect, describe, it } from 'vitest';
import { ValidBlockTarget } from './index';
import { check, MockTheme } from '../../test';
import { Dependencies } from '../../types';

describe('Module: ValidBlockTarget', () => {
  const paths = ['sections', 'blocks'];

  describe('File Existence Tests', () => {
    paths.forEach((path) => {
      it(`should ignore @app and @theme block types in ${path} bucket`, async () => {
        const theme: MockTheme = {
          [`${path}/app-theme.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.be.empty;
      });

      it(`should not report any errors when all block files exist (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/text.liquid': '',
          [`${path}/valid.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "text"
                }
              ]
            }
            {% endschema %}
          `,
        };

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.be.empty;
      });

      it(`should report errors when root level block file does not exist (${path} bucket)`, async () => {
        const theme: MockTheme = {
          [`${path}/invalid-section.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "invalid"
                }
              ]
            }
            {% endschema %}
          `,
        };

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal("Theme block 'blocks/invalid.liquid' does not exist.");
      });

      it(`should report an error when a preset defined block file does not exist (${path} bucket)`, async () => {
        const theme: MockTheme = {
          [`${path}/invalid-block.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "@theme"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "missing_block"
                    }
                  ]
                }
              ]
            }
            {% endschema %}
          `,
        };

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal(
          "Theme block 'blocks/missing_block.liquid' does not exist.",
        );
      });

      it(`should not report subsequent errors in present defined blocks if error in root level (${path} bucket)`, async () => {
        const theme: MockTheme = {
          [`${path}/invalid-block.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "invalid"
                }
              ],
              "presets": [
                {
                  "name": "Default",
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal("Theme block 'blocks/invalid.liquid' does not exist.");
      });
    });
  });

  describe('Allowed Targeting Tests', () => {
    paths.forEach((path) => {
      it(`should report an error when a preset defined block is not specified at root level (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/text.liquid': '',
          [`${path}/invalid-preset.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "text"
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal(
          'Theme block type "invalid_preset_block" must be allowed in "blocks" at the root of this schema.',
        );
      });

      it(`should report errors for private blocks even when @theme is specified at root level (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/_private.liquid': '',
          [`${path}/private-blocks.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "@theme"
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal(
          'Theme block type "_private" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.',
        );
      });

      it(`should report errors with correct indices (${path} bucket)`, async () => {
        const theme: MockTheme = {
          [`${path}/private-blocks.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "@theme"
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);

        const content = theme[`${path}/private-blocks.liquid`];
        const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
        expect(erroredContent).to.equal('"_private"');
      });

      it(`should not report errors for private blocks when listed at root level (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/_private.liquid': '',
          [`${path}/private-blocks.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "_private"
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.be.empty;
      });

      it(`should handle mixed private and public blocks correctly (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/_private.liquid': '',
          'blocks/custom.liquid': '',
          [`${path}/mixed-blocks.liquid`]: `
            {% schema %}
            {
              "name": "${path === 'sections' ? 'Section' : 'Block'} name",
              "blocks": [
                {
                  "type": "@theme"
                },
                {
                  "type": "_private"
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
                      "type": "custom"
                    }
                  ]
                }
              ]
            }
            {% endschema %}
          `,
        };

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.be.empty;
      });
    });
  });
});
