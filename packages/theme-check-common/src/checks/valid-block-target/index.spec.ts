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

      it(`should report an error when a preset defined block file does not exist with hash-style presets (${path} bucket)`, async () => {
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
                  "blocks": {
                    "missing_block_hash": {
                      "type": "missing_block"
                    }
                  },
                  "block_order": ["missing_block_hash"]
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

      it(`should not report an error when a preset defined block file exists with hash-style presets (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/text.liquid': '',
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
                  "blocks": {
                    "text_block": {
                      "type": "text"
                    }
                  },
                  "block_order": ["text_block"]
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

    it('should not report errors for locally scoped blocks at root level', async () => {
      const theme: MockTheme = {
        'sections/local-blocks.liquid': `
          {% schema %}
          {
            "name": "Section name",
            "blocks": [
              {
                "type": "local_block",
                "name": "Local block"
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

      it(`should report an error when a preset defined block is not specified at root level with hash-style presets (${path} bucket)`, async () => {
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
                  "blocks": {
                    "invalid_preset_block_hash": {
                      "type": "invalid_preset_block"
                    }
                  },
                  "block_order": ["invalid_preset_block_hash"]
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

      it(`should report errors for private blocks even when @theme is specified at root level with hash-style presets (${path} bucket)`, async () => {
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
                  "blocks": {
                    "private_hash": {
                      "type": "_private"
                    }
                  },
                  "block_order": ["private_hash"]
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

      it(`should not report errors for private blocks when listed at root level with hash-style presets (${path} bucket)`, async () => {
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
                  "blocks": {
                    "private_hash": {
                      "type": "_private"
                    }
                  },
                  "block_order": ["private_hash"]
                }
              ]
            }
            {% endschema %}
          `,
        };

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.be.empty;
      });

      it(`should report errors for nested blocks when they are not allowed (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/group.liquid': '',
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "text"
                },
                {
                  "type": "image"
                }
              ]
            }
            {% endschema %}
          `,
          'sections/slideshow.liquid': `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "slide",
                      "blocks": [
                        {
                          "type": "group"
                        }
                      ]
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
          'Block type "group" is not allowed in "slide" blocks. Allowed types are: text, image.',
        );
      });

      it(`should report errors for nested private blocks when they are not allowed (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/_private.liquid': '',
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "text"
                },
                {
                  "type": "image"
                }
              ]
            }
            {% endschema %}
          `,
          'sections/slideshow.liquid': `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "slide",
                      "blocks": [
                        {
                          "type": "_private"
                        }
                      ]
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
          'Private block type "_private" is not allowed in "slide" blocks.',
        );
      });

      it(`should report errors for nested blocks when they are not allowed with hash-style presets (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/group.liquid': '',
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "text"
                },
                {
                  "type": "image"
                }
              ]
            }
            {% endschema %}
          `,
          'sections/slideshow.liquid': `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": {
                    "slide_hash": {
                      "type": "slide",
                      "blocks": {
                        "group_hash": {
                           "type": "group"
                        }
                      }
                    }
                  }
                }
              ]
            }
            {% endschema %}
          `,
        };

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal(
          'Block type "group" is not allowed in "slide" blocks. Allowed types are: text, image.',
        );
      });

      it(`should report errors for further nested blocks when they are not allowed (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/group.liquid': `
            {% schema %}
            {
              "name": "Group",
              "blocks": [
                {
                  "type": "text"
                }
              ]
            }
            {% endschema %}
          `,
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "group"
                }
              ]
            }
            {% endschema %}
          `,
          'sections/slideshow.liquid': `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "slide",
                      "blocks": [
                        {
                          "type": "group",
                          "blocks": [
                            {
                              "type": "image"
                            }
                          ]
                        }
                      ]
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
          'Block type "image" is not allowed in "group" blocks. Allowed types are: text.',
        );
      });

      it(`should report errors with correct indices for nested blocks when they are not allowed (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/group.liquid': '',
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "text"
                },
                {
                  "type": "image"
                }
              ]
            }
            {% endschema %}
          `,
          'sections/slideshow.liquid': `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "slide",
                      "blocks": [
                        {
                          "type": "group"
                        }
                      ]
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
        const content = theme['sections/slideshow.liquid'];
        const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
        expect(erroredContent).to.equal('"group"');
      });

      it(`should not report errors for nested blocks when they are allowed (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "text"
                },
                {
                  "type": "image"
                }
              ]
            }
            {% endschema %}
          `,
          'sections/slideshow.liquid': `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "slide",
                      "blocks": [
                        {
                          "type": "image"
                        }
                      ]
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
