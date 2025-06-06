import { expect, describe, it } from 'vitest';
import { ValidBlockTarget } from './index';
import { check, MockTheme } from '../../test';
import { Preset, Setting } from '../../types/schemas';

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

      if (path === 'sections') {
        it(`should report an error when default defined block file does not exist`, async () => {
          const theme: MockTheme = {
            [`${path}/invalid-file.liquid`]: `
              {% schema %}
              {
                "name": "Section name",
                "blocks": [
                  {
                    "type": "@theme"
                  }
                ],
                "default": {
                  "title": "Default",
                  "blocks": [
                    {
                      "name": "some block",
                      "type": "missing_block"
                    }
                  ]
                }
              }
              {% endschema %}
            `,
          };

          const offenses = await check(theme, [ValidBlockTarget]);
          expect(offenses).to.have.length(1);
          expect(offenses).to.containOffense(
            "Theme block 'blocks/missing_block.liquid' does not exist.",
          );
        });
      }

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
        expect(offenses).to.have.length(2);
        expect(offenses).to.containOffense(
          'Theme block type "invalid_preset_block" must be allowed in "blocks" at the root of this schema.',
        );
        expect(offenses).to.containOffense(
          "Theme block 'blocks/invalid_preset_block.liquid' does not exist.",
        );
      });

      if (path === 'sections') {
        it(`should report an error when a default defined block is not specified at root level`, async () => {
          const theme: MockTheme = {
            'blocks/text.liquid': '',
            [`${path}/invalid-preset.liquid`]: `
              {% schema %}
              {
                "name": "Section name",
                "blocks": [
                  {
                    "type": "text"
                  }
                ],
                "default": {
                  "name": "Default",
                  "blocks": [
                    {
                      "name": "invalid_preset_block",
                      "type": "invalid_preset_block"
                    }
                  ]
                }
              }
              {% endschema %}
            `,
          };

          const offenses = await check(theme, [ValidBlockTarget]);
          expect(offenses).to.have.length(2);
          expect(offenses).to.containOffense(
            'Theme block type "invalid_preset_block" must be allowed in "blocks" at the root of this schema.',
          );
          expect(offenses).to.containOffense(
            "Theme block 'blocks/invalid_preset_block.liquid' does not exist.",
          );
        });
      }

      it(`should report errors in presets for private blocks even when @theme is specified at root level (${path} bucket)`, async () => {
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
        expect(offenses).to.containOffense(
          'Theme block type "_private" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.',
        );
      });

      if (path === 'sections') {
        it(`should report errors in default for private blocks even when @theme is specified at root level`, async () => {
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
                "default": {
                  "name": "Default",
                  "blocks": [
                    {
                      "name": "private",
                      "type": "_private"
                    }
                  ]
                }
              }
              {% endschema %}
            `,
          };

          const offenses = await check(theme, [ValidBlockTarget]);
          expect(offenses).to.have.length(1);
          expect(offenses).to.containOffense(
            'Theme block type "_private" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.',
          );
        });
      }

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
        expect(offenses).to.have.length(2);

        for (const offense of offenses) {
          const content = theme[`${path}/private-blocks.liquid`];
          const erroredContent = content.slice(offense.start.index, offense.end.index);
          expect(erroredContent).to.equal('"_private"');
        }
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
        expect(offenses).to.have.length(2);
        expect(offenses).to.containOffense(
          'Theme block type "invalid_preset_block" must be allowed in "blocks" at the root of this schema.',
        );
        expect(offenses).to.containOffense(
          "Theme block 'blocks/invalid_preset_block.liquid' does not exist.",
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
          [`${path}/slideshow.liquid`]: `
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
          [`${path}/slideshow.liquid`]: `
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
          [`${path}/slideshow.liquid`]: `
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
          [`${path}/slideshow.liquid`]: `
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

      describe(`Static Blocks used in a ${path} file`, () => {
        const textSetting: Setting.Text = {
          type: 'text' as Setting.Type.Text,
          id: 'text',
          label: 'Text',
        };

        describe('When presets are defined as a hash', () => {
          describe('When the static block is used in the same file', () => {
            const makeTheme = (
              preset: Preset.PresetBlockHash,
              blocks_order: string[] = [],
            ): MockTheme => {
              return {
                [`${path}/slideshow.liquid`]: `
                  # Static block is defined in the body of the file
                  {% content_for "block", type: "static", id: "static_id" %}

                  {% schema %}
                    {
                      "name": "Slideshow",
                      "presets": [
                        {
                          "name": "Default",
                          "blocks": ${JSON.stringify(preset, null, 2)},
                          "block_order": ${JSON.stringify(blocks_order)}
                        }
                      ]
                    }
                  {% endschema %}
                `,
                'blocks/static.liquid': `
                  {% schema %}
                    {
                      "name": "some static block",
                      "settings": [${JSON.stringify(textSetting)}]
                    }
                  {% endschema %}
                `,
              };
            };

            it(`is silent for valid static blocks references`, async () => {
              const theme: MockTheme = makeTheme({
                static_id: {
                  type: 'static',
                  static: true,
                  settings: {
                    text: 'some text',
                  },
                },
              });
              const offenses = await check(theme, [ValidBlockTarget]);
              expect(offenses).to.be.empty;
            });

            it(`reports a warning for missing (or mismatching) static blocks references`, async () => {
              const theme: MockTheme = makeTheme({
                mismatching_id: {
                  type: 'static',
                  static: true,
                  settings: {
                    text: 'some text',
                  },
                },
              });

              const offenses = await check(theme, [ValidBlockTarget]);
              expect(offenses).not.to.be.empty;
              expect(offenses).to.containOffense(
                'Could not find a static block of type "static" with id "mismatching_id" in this file.',
              );
            });
          });

          describe('When the static block preset is defined in a nested block', () => {
            const makeTheme = (
              preset: Preset.PresetBlockHash,
              blocks_order: string[] = [],
            ): MockTheme => {
              return {
                [`${path}/slideshow-container.liquid`]: `
                  # This file demonstrates how a static block can be used inside a nested block's preset
                  {% content_for "blocks" %}

                  {% schema %}
                    {
                      "name": "Slideshow container",
                      "blocks": [{ "type": "slideshow" }],
                      "presets": [{
                        "name": "default",
                        "block_order": ["slideshow1"],
                        "blocks": {
                          "slideshow1": {
                            "type": "slideshow",
                            "blocks": ${JSON.stringify(preset, null, 2)},
                            "block_order": ${JSON.stringify(blocks_order)}
                          }
                        }
                      }]
                    }
                  {% endschema %}
                `,
                [`blocks/slideshow.liquid`]: `
                  # Static block is defined in the body of the file
                  {% content_for "block", type: "static", id: "static_id" %}
                  # ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

                  {% schema %}
                    { "name": "Slideshow" }
                  {% endschema %}
                `,
                'blocks/static.liquid': `
                  {% schema %}
                    {
                      "name": "some static block",
                      "settings": [${JSON.stringify(textSetting)}]
                    }
                  {% endschema %}
                `,
              };
            };

            it('is silent for valid static blocks references', async () => {
              const theme = makeTheme({
                static_id: {
                  type: 'static',
                  static: true,
                },
              });
              const offenses = await check(theme, [ValidBlockTarget]);
              expect(offenses).to.be.empty;
            });

            it('reports warnings when using a mismatching (or nonexisting) static block', async () => {
              const theme = makeTheme({
                mismatching_id: {
                  type: 'static',
                  static: true,
                },
              });
              const offenses = await check(theme, [ValidBlockTarget]);
              expect(offenses).not.to.be.empty;
              expect(offenses).to.containOffense(
                'Could not find a static block of type "static" with id "mismatching_id" in "blocks/slideshow.liquid".',
              );
            });
          });
        });

        describe('When preset are defined as an array', () => {
          describe('When the static block is used in the same file', () => {
            const makeTheme = (preset: Preset.PresetBlockForArray[]): MockTheme => {
              return {
                'blocks/static.liquid': `
                  {% schema %}
                  {
                    "name": "some static block",
                    "settings": [{ "label": "some setting", "type": "text", "id": "text" }],
                  }
                  {% endschema %}
                `,
                [`${path}/slideshow.liquid`]: `

                  # Static block is defined in the body of the file
                  {% content_for "block", type: "static", id: "static_id" %}
                  # ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

                  {% schema %}
                  {
                    "name": "Slideshow",
                    "presets": [
                      {
                        "name": "Default",
                        "blocks": ${JSON.stringify(preset, null, 2)}
                      }
                    ]
                  }
                  {% endschema %}
                `,
              };
            };

            it(`is silent for valid static blocks references (${path} bucket)`, async () => {
              const theme: MockTheme = makeTheme([
                {
                  type: 'static',
                  id: 'static_id',
                  static: true,
                  settings: {
                    text: 'some text',
                  },
                },
              ]);
              const offenses = await check(theme, [ValidBlockTarget]);
              expect(offenses).to.be.empty;
            });

            it(`reports a warning for missing (or mismatching) static blocks references (${path} bucket)`, async () => {
              const theme: MockTheme = makeTheme([
                {
                  type: 'static',
                  id: 'mismatching_id',
                  static: true,
                  settings: {
                    text: 'some text',
                  },
                },
              ]);

              const offenses = await check(theme, [ValidBlockTarget]);
              expect(offenses).not.to.be.empty;
              expect(offenses).to.containOffense(
                'Could not find a static block of type "static" with id "mismatching_id" in this file.',
              );
            });
          });
        });

        describe('When the static block preset is defined in a nested block', () => {
          const makeTheme = (
            preset: Preset.PresetBlockForArray[],
            blocks_order: string[] = [],
          ): MockTheme => {
            return {
              [`${path}/slideshow-container.liquid`]: `
                # This file demonstrates how a static block can be used inside a nested block's preset
                {% content_for "blocks" %}

                {% schema %}
                  {
                    "name": "Slideshow container",
                    "blocks": [{ "type": "slideshow" }],
                    "presets": [{
                      "name": "default",
                      "blocks": [
                        {
                          "type": "slideshow",
                          "id": "slideshow1",
                          "blocks": ${JSON.stringify(preset, null, 2)},
                        }
                      ]
                    }]
                  }
                {% endschema %}
              `,
              [`blocks/slideshow.liquid`]: `
                # Static block is defined in the body of the file
                {% content_for "block", type: "static", id: "static_id" %}
                # ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

                {% schema %}
                  { "name": "Slideshow" }
                {% endschema %}
              `,
              'blocks/static.liquid': `
                {% schema %}
                  {
                    "name": "some static block",
                    "settings": [${JSON.stringify(textSetting)}]
                  }
                {% endschema %}
              `,
            };
          };

          it('is silent for valid static blocks references', async () => {
            const theme = makeTheme([
              {
                id: 'static_id',
                type: 'static',
                static: true,
              },
            ]);
            const offenses = await check(theme, [ValidBlockTarget]);
            expect(offenses).to.be.empty;
          });

          it('reports warnings when using a mismatching (or nonexisting) static block', async () => {
            const theme = makeTheme([
              {
                id: 'mismatching_id',
                type: 'static',
                static: true,
              },
            ]);
            const offenses = await check(theme, [ValidBlockTarget]);
            expect(offenses).not.to.be.empty;
            expect(offenses).to.containOffense(
              'Could not find a static block of type "static" with id "mismatching_id" in "blocks/slideshow.liquid".',
            );
          });
        });
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
          [`${path}/slideshow.liquid`]: `
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
        const content = theme[`${path}/slideshow.liquid`];
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
          [`${path}/slideshow.liquid`]: `
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

      it(`should report errors on the correct file for nested blocks when they are not allowed (${path} bucket)`, async () => {
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
          [`${path}/slideshow.liquid`]: `
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
        expect(offenses).to.have.lengthOf(1);
        expect(offenses[0].uri).to.equal(`file:///${path}/slideshow.liquid`);
      });

      it('should not crash or timeout with cyclical nested block relationships', async () => {
        const theme: MockTheme = {
          'blocks/block-b.liquid': `
          {% schema %}
          {
            "name": "Block B",
            "blocks": [
              {
                "type": "block-c"
              }
            ]
          }
          {% endschema %}
        `,
          'blocks/block-a.liquid': `
          {% schema %}
          {
            "name": "Block A",
            "blocks": [
              {
                "type": "block-b"
              }
            ],
            "presets": [
              {
                "name": "Default",
                "blocks": [
                  {
                    "type": "block-b",
                    "blocks": [
                      {
                        "type": "block-c"
                      }
                    ]
                  }
                ]
              }
            ]
          }
          {% endschema %}
        `,
          'blocks/block-c.liquid': `
          {% schema %}
          {
            "name": "Block C",
            "blocks": [
              {
                "type": "block-a"
              }
            ],
            "presets": [
              {
                "name": "Default",
                "blocks": [
                  {
                    "type": "block-a",
                    "blocks": [
                      {
                        "type": "block-b"
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

        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test exceeded 500 ms')), 500),
        );

        const testPromise = (async () => {
          const offenses = await check(theme, [ValidBlockTarget]);
          expect(offenses).to.be.empty;
        })();

        await Promise.race([testPromise, timeout]);
      });
    });
  });
});
