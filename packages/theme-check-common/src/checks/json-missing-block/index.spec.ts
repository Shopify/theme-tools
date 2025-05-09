import { expect, describe, it } from 'vitest';
import { JSONMissingBlock } from './index';
import { check, MockTheme } from '../../test';

describe('Module: JsonMissingBlock', () => {
  describe('File existence validation', () => {
    it('should report an offense when a block does not exist', async () => {
      const theme: MockTheme = {
        'templates/product.failing.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "text_tqQTNE": {
                  "type": "missing_block"
                }
              },
              "block_order": ["text_tqQTNE"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "missing_block"
              }
            ]
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Theme block 'blocks/missing_block.liquid' does not exist.",
      );

      const content = theme['templates/product.failing.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"missing_block"');
    });

    it('should not report an offense when block exists', async () => {
      const theme: MockTheme = {
        'templates/product.valid.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "text_block": {
                  "type": "text"
                }
              },
              "block_order": ["text_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "text"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.be.empty;
    });

    it('should report an offense when a nested block does not exist', async () => {
      const theme: MockTheme = {
        'templates/product.nested.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "parent_block": {
                  "type": "text",
                  "blocks": {
                    "child_block": {
                      "type": "missing_nested"
                    }
                  }
                }
              },
              "block_order": ["parent_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "text"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': `
        {% schema %}
          {
            "name": "Text Block",
            "blocks": [
              {
                "type": "missing_nested"
              }
            ]
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Theme block 'blocks/missing_nested.liquid' does not exist.",
      );

      const content = theme['templates/product.nested.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"missing_nested"');
    });
  });

  describe('Allowed block type validation', () => {
    it('should report an offense when block exists but is not in the section liquid schema', async () => {
      const theme: MockTheme = {
        'templates/product.valid.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "text_block": {
                  "type": "text"
                }
              },
              "block_order": ["text_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "image"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': '',
        'blocks/image.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Block type 'text' is not allowed in 'sections/custom-section.liquid'.",
      );

      const content = theme['templates/product.valid.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"text"');
    });

    it('should report an offense when a nested block exists but is not in the block liquid schema', async () => {
      const theme: MockTheme = {
        'templates/product.nested.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "parent_block": {
                  "type": "text",
                  "blocks": {
                    "child_block": {
                      "type": "missing_nested"
                    }
                  }
                }
              },
              "block_order": ["parent_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "text"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': `
        {% schema %}
          {
            "name": "Text Block",
            "blocks": [
              {
                "type": "image"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/image.liquid': '',
        'blocks/missing_nested.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Block type 'missing_nested' is not allowed in 'blocks/text.liquid'.",
      );

      const content = theme['templates/product.nested.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"missing_nested"');
    });

    it('should report an offense when a nested private block exists but is not in the block liquid schema', async () => {
      const theme: MockTheme = {
        'templates/product.nested.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "parent_block": {
                  "type": "text",
                  "blocks": {
                    "child_block": {
                      "type": "_private_block"
                    }
                  }
                }
              },
              "block_order": ["parent_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "text"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': `
        {% schema %}
          {
            "name": "Text Block",
            "blocks": [
              {
                "type": "@theme"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/image.liquid': '',
        'blocks/_private_block.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "Block type '_private_block' is not allowed in 'blocks/text.liquid'.",
      );

      const content = theme['templates/product.nested.json'];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal('"_private_block"');
    });

    it('should not report an offense when a static block exists and is not in the block liquid schema', async () => {
      const theme: MockTheme = {
        'templates/product.static.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "child_block": {
                  "type": "text"
                },
                "static_block": {
                  "type": "static_block",
                  "static": true
                }
              },
              "block_order": ["child_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "text"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': `
        {% schema %}
          {
            "name": "Text Block",
            "blocks": [
              {
                "type": "@theme"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/static_block.liquid': `
        {% schema %}
          {
            "name": "Static Block",
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.have.length(0);
    });
  });

  describe('Edge case validation', () => {
    it('should ignore non-template JSON files', async () => {
      const theme: MockTheme = {
        'config/index.json': `{
          "blocks": {
            "text_block": {
              "type": "nonexistent"
            }
          }
        }`,
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.be.empty;
    });

    it('should ignore templates with local blocks', async () => {
      const theme: MockTheme = {
        'templates/product.nested.json': `{
          "sections": {
            "custom-section": {
              "type": "custom-section",
              "blocks": {
                "parent_block": {
                  "type": "text",
                  "blocks": {
                    "child_block": {
                      "type": "_private_block"
                    }
                  }
                }
              },
              "block_order": ["parent_block"]
            }
          },
          "order": ["custom-section"]
        }`,
        'sections/custom-section.liquid': `
          {% schema %}
          {
            "name": "Custom Section",
            "blocks": [
              {
                "type": "text",
                "name": "Text Block"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/text.liquid': `
        {% schema %}
          {
            "name": "Text Block",
            "blocks": [
              {
                "type": "image",
                "name": "Image Block"
              }
            ]
          }
          {% endschema %}
        `,
        'blocks/image.liquid': '',
        'blocks/_private_block.liquid': '',
      };

      const offenses = await check(theme, [JSONMissingBlock]);
      expect(offenses).to.be.empty;
    });
  });
});
