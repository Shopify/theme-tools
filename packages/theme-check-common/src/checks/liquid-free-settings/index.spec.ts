import { expect, describe, it } from 'vitest';
import { LiquidFreeSettings } from './index';
import { check, MockTheme } from '../../test';

describe('LiquidFreeSettings validation', () => {
  const paths = ['sections', 'blocks'];
  paths.forEach((path) => {
    it(`should not report errors for valid settings without liquid logic in ${path} bucket`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "Section name",
          "settings": [
            {
              "id": "text_value",
              "type": "text",
              "label": "Text Value",
              "default": "Some text without liquid logic."
            }
          ]
        }
        {% endschema %}
      `,
      };

      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).to.have.length(0);
    });

    it(`should not report errors for valid settings with dynamic source liquid logic in ${path} bucket`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "Section name",
          "settings": [
            {
              "id": "text_value",
              "type": "text",
              "label": "Text Value",
              "default": "Title {{ product.title }}"
            }
          ]
        }
        {% endschema %}
      `,
      };

      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).to.have.length(0);
    });

    it(`should report an error when settings value contains Liquid logic in ${path} bucket`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "Section name",
          "settings": [
            {
              "id": "input_with_logic",
              "type": "text",
              "label": "Input with Logic",
              "default": "Hello {% if user %} User {% endif %}!"
            }
          ]
        }
        {% endschema %}
      `,
      };

      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Settings values cannot contain liquid logic.');
    });

    it(`should report an error with correct indices when settings value contains Liquid logic in ${path} bucket`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "Section name",
          "settings": [
            {
              "id": "input_with_logic",
              "type": "text",
              "label": "Input with Logic",
              "default": "Hello {% if user %} User {% endif %}!"
            }
          ]
        }
        {% endschema %}
      `,
      };

      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).to.have.length(1);
      const content = theme[`${path}/test-section.liquid`];
      const errorContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(errorContent).to.equal('"Hello {% if user %} User {% endif %}!"');
    });

    it(`should report an error when settings value contains Liquid logic in object format in ${path} bucket`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "test",
          "settings": {
            "text_block": {
              "type": "text",
              "id": "text_block",
              "label": "Text Block",
              "default": "Hello {% if user %} User {% endif %}!"
            }
          }
        }
      {% endschema %}
      `,
      };

      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Settings values cannot contain liquid logic.');
    });

    it(`should report errors when preset block values contain Liquid logic in ${path} bucket`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "Section name",
          "presets": [
            {
              "name": "Default",
              "block": [
                {
                  "type": "text",
                  "settings": {
                    "text": "Hello World!{% random liquid logic %}"
                  }
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
      };

      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Settings values cannot contain liquid logic.');
    });

    it(`should not report errors when settings value is available_if and it contains liquid logic`, async () => {
      const theme: MockTheme = {
        [`${path}/test-section.liquid`]: `
        {% schema %}
        {
          "name": "test",
          "settings": {
            "text_block": {
              "type": "text",
              "id": "text_block",
              "label": "Text Block",
              "default": "Hello World!",
              "visible_if": "{% if user %} true {% endif %}"
            }
          }
        }
      {% endschema %}
      `,
      };
      const offenses = await check(theme, [LiquidFreeSettings]);
      expect(offenses).toEqual([]);
    });
  });
});
