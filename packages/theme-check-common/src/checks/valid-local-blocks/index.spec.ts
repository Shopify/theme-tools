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

  it('should report errors when preset defined local blocks are defined in a block bucket', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': '',
      'blocks/local-blocks.liquid': `
        {% schema %}
        {
            "name": "Block name",
            "blocks": [
            {
                "type": "text"
            }
            ],
            "presets": [
            {
                "name": "Default",
                "blocks": [
                {
                    "type": "local_block",
                    "name": "Local Block"
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

  it('should report errors when static theme blocks have a name property', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
        {% schema %}
        {
            "name": "Section name",
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
                    "id": "static_block",
                    "type": "static_block",
                    "static": true,
                    "name": "Static Text Block"
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
    expect(offenses[0].message).to.equal('Static theme blocks cannot have a name property.');
  });

  it('should report errors when static theme blocks have a name property within nested blocks', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
        {% schema %}
        {
            "name": "Section name",
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
                   "type": "text",
                   "blocks": [
                    {
                        "id": "static_block",
                        "type": "static_block",
                        "static": true,
                        "name": "Static Text Block"
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
    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Static theme blocks cannot have a name property.');
  });
});

describe('ValidLocalBlocks with hash-style presets', () => {
  it('should report errors when preset defined local blocks are defined in a block bucket with hash-style presets', async () => {
    const theme: MockTheme = {
      'blocks/text.liquid': '',
      'blocks/local-blocks.liquid': `
          {% schema %}
          {
            "name": "Block name",
            "blocks": [
              {
                "type": "text"
              }
            ],
            "presets": [
              {
                "name": "Default",
                "blocks": {
                  "local_block": {
                    "type": "local_block",
                    "name": "Local Block"
                  }
                },
                "block_order": ["local_block"]
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

  it('should report errors when sections use static theme blocks together with locally scoped blocks in hash-style presets', async () => {
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
                    "static_block": {
                      "type": "static_block",
                      "static": true
                    }
                  }
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

  it('should report errors with correct indices when sections use static theme blocks together with locally scoped blocks in hash-style presets', async () => {
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
                  "my_static_block": {
                    "type": "static_block",
                    "static": true
                  }
                }
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

  it('should report errors when static theme blocks have a name property in hash-style presets', async () => {
    const theme: MockTheme = {
      'sections/local-blocks.liquid': `
          {% schema %}
          {
            "name": "Section name",
            "blocks": [
              {
                "type": "@theme"
              }
            ],
            "presets": [
              {
                "name": "Default",
                "blocks": {
                  "static_block": {
                    "type": "static_block",
                    "static": true,
                    "name": "Static Text Block"
                  }
                }
              }
            ]
          }
          {% endschema %}
        `,
    };

    const offenses = await check(theme, [ValidLocalBlocks]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Static theme blocks cannot have a name property.');
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
});
