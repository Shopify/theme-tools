import { expect, describe, it } from 'vitest';
import { ValidLocalBlocks } from './index';
import { check, MockTheme } from '../../test';

describe('ValidLocalBlocks with array-style blocks', () => {
  it('should report errors when root level local blocks are defined in a block bucket', async () => {
    const theme: MockTheme = {
      'blocks/local-blocks.liquid': `
        {% schema %}
        {
            "name": "Block name",
            "blocks": [
            {
                "type": "local_block",
                "name": "Local Block"
            }
            ]
        }
        {% endschema %}
        `,
    };

    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Local scoped blocks are not supported in theme blocks.');
  });

  it('should report errors when sections use theme blocks together with locally scoped blocks in root level', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': '',
      'sections/local-blocks.liquid': `
        {% schema %}
        {
            "name": "Section name",
            "blocks": [
            {
                "type": "text"
            },
            {
                "type": "local_block",
                "name": "Local Block"
            }
            ]
        }
        {% endschema %}
        `,
    };
    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Sections cannot use theme blocks together with locally scoped blocks.',
    );
  });

  it('should report errors when sections use static theme blocks together with locally scoped blocks', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
            {% schema %}
            {
                "name": "Section name",
                "blocks": [
                {
                    "type": "local_block",
                    "name": "Local Block"
                }
                ],
                "presets": [
                {
                    "name": "Default",
                    "blocks": [
                    {
                        "id": "static_block",
                        "type": "static_block",
                        "static": true
                    }
                    ]
                }
                ]
            }
            {% endschema %}
            `,
    };
    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Sections cannot use static theme blocks together with locally scoped blocks.',
    );
  });

  it('should report errors with correct indices when sections use static theme blocks together with locally scoped blocks', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
                {% schema %}
                {
                "name": "Section name",
                "blocks": [
                    {
                    "type": "local_block",
                    "name": "Local Block"
                    }
                ],
                "presets": [
                    {
                    "name": "Default",
                    "blocks": [
                        {
                        "id": "static_block",
                        "type": "static_block",
                        "static": true
                        }
                    ]
                    }
                ]
                }
                {% endschema %}
            `,
    };
    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.have.length(1);

    const content = theme['sections/local-blocks.liquid'];
    const errorContent = content.slice(offenses[0].start.index, offenses[0].end.index);
    expect(errorContent).to.equal('"static_block"');
  });
});

describe('ValidLocalBlocks on edge cases', () => {
  it('should not report errors for block setting types', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "@app"
            },
            {
              "type": "link_list",
              "name": "Link list",
              "settings": [
                {
                  "type": "inline_richtext",
                  "id": "heading",
                  "default": "Heading"
                },
                {
                  "type": "link_list",
                  "id": "menu",
                  "default": "Footer"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.be.empty;
  });

  it('should not report errors when @app is used alongside static blocks', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "@app"
            },
            {
              "type": "static_block",
              "static": true
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.be.empty;
  });

  it('should not report errors on themes that define local blocks at the root level and use them in presets', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "local_block",
              "name": "Local Block"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "local_block"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.be.empty;
  });

  it('should not report errors on older themes that define local blocks at the root level and use them in hash-style presets', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "local_block",
              "name": "Local Block"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": {
                "local_block": {
                  "type": "local_block"
                }
              }
            }
          ]
        }
        {% endschema %}
      `,
    };
    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.be.empty;
  });

  it('should not report errors when preset blocks have a name property', async () => {
    const theme: MockTheme = {
      'blocks/product-grid.liquid': `
      {% schema %}
      {
        "name": "Product grid",
        "blocks": [{ "type": "product-card" }],
        "presets": [
          {
            "name": "Product grid",
            "blocks": {
              "product-grid-card": {
                "type": "product-card",
                "static": true,
                "blocks": {
                  "card_gallery_eK4Hr7": {
                    "type": "card-gallery",
                    "name": "potato",
                  },
                  "group_4RMFLV": {
                    "type": "group"
                  }
                },
                "block_order": ["card_gallery_eK4Hr7", "group_4RMFLV"]
              }
            }
          }
        ]
      }
      {% endschema %}

      `,
    };

    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.be.empty;
  });
});
