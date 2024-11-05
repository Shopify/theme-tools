import { expect, describe, it } from 'vitest';
import { BlockTargeting } from './index';
import { check, MockTheme } from '../../test';

describe('Module: BlockTargeting', () => {
  it('should not report any errors when preset blocks reference valid block types', async () => {
    const theme: MockTheme = {
      'sections/valid.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "text",
              "name": "Text"
            },
            {
              "type": "image",
              "name": "Image"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "text"
                },
                {
                  "type": "image"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.be.empty;
  });

  it('should report an error when preset blocks reference undefined block types', async () => {
    const theme: MockTheme = {
      'sections/invalid.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "text",
              "name": "Text"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "undefined_block"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("Preset block type 'undefined_block' is not valid");
  });

  it('should report errors for nested invalid block types', async () => {
    const theme: MockTheme = {
      'sections/nested-invalid.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "parent",
              "name": "Parent"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "parent",
                  "blocks": [
                    {
                      "type": "invalid_child"
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

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("Preset block type 'invalid_child' is not valid");
  });

  it('should report multiple errors for multiple invalid block types', async () => {
    const theme: MockTheme = {
      'sections/multiple-invalid.liquid': `
        {% schema %}
        {
          "name": "Section name",
          "blocks": [
            {
              "type": "text",
              "name": "Text"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "invalid_1"
                },
                {
                  "type": "invalid_2"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal("Preset block type 'invalid_1' is not valid");
    expect(offenses[1].message).to.equal("Preset block type 'invalid_2' is not valid");
  });

  it('should not report errors for @theme block types', async () => {
    const theme: MockTheme = {
      'sections/theme-blocks.liquid': `
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
                  "type": "invalid_1"
                },
                {
                  "type": "invalid_2"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.be.empty;
  });

  it('should report errors for private blocks even without @theme', async () => {
    const theme: MockTheme = {
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
                  "type": "_private_block"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("Preset block type '_private_block' is not valid");
  });

  it('should not report errors for private blocks when listed at root level', async () => {
    const theme: MockTheme = {
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
              "type": "_private_block",
              "name": "Private"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "_private_block"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.be.empty;
  });

  it('should handle mixed private and public blocks correctly', async () => {
    const theme: MockTheme = {
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
              "type": "_private_block",
              "name": "Private"
            },
            {
              "type": "_another_private",
              "name": "Another Private"
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                {
                  "type": "_private_block"
                },
                {
                  "type": "invalid_public_block"
                },
                {
                  "type": "_another_private"
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [BlockTargeting]);
    expect(offenses).to.be.empty;
  });
});
