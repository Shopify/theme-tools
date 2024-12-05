import { describe, expect, it } from 'vitest';
import { ValidBlockPresetSettings } from '.';
import { check } from '../../test/test-helper';
import { MockTheme } from '../../test/MockTheme';

describe('ValidBlockPresetSettings', () => {
  it('should report invalid preset settings', async () => {
    const theme: MockTheme = {
      'blocks/price.liquid': `
        {% schema %}
        {
          "name": "t:names.product_price",
          "settings": [
            {
              "type": "product",
              "id": "product",
              "label": "t:settings.product"
            },
            {
              "type": "collection",
              "id": "collection",
              "label": "t:settings.collection"
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": { 
                "product": "{{ context.product }}",
                "undefined_setting": "some value"
              }
            }
          ]
        }
        {% endschema %}
      `,
    };
    const offenses = await check(theme, [ValidBlockPresetSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      'Preset setting "undefined_setting" does not exist in settings',
    );
  });

  it('should report invalid block preset settings', async () => {
    const theme: MockTheme = {
      'blocks/block_1.liquid': `
      {% schema %}
      {
        "name": "t:names.block_1",
        "settings": [
          {
            "type": "text",
            "id": "block_1_setting_key",
            "label": "t:settings.block_1"
          }
        ]
      }
      {% endschema %}
    `,
      'blocks/price.liquid': `
        {% schema %}
        {
          "name": "t:names.product_price",
          "settings": [
            {
              "type": "product",
              "id": "product",
              "label": "t:settings.product"
            },
            {
              "type": "collection",
              "id": "collection",
              "label": "t:settings.collection"
            }
          ],
          "blocks": [
            {
              "type": "block_1",
              "name": "t:names.block_1"
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": {
                "product": "{{ context.product }}",
                "collection": "{{ context.collection }}"
              },
              "blocks": [
                {
                  "block_1": {
                    "type": "block_1",
                    "settings": {
                      "block_1_setting_key": "correct setting key",
                      "undefined_setting": "incorrect setting key"
                    }
                  }
                }
              ]
            },
            {
              "name": "t:names.product_price_2",
              "settings": {
                "product": "{{ context.product }}",
                "collection": "{{ context.collection }}"
              }
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidBlockPresetSettings]);
    expect(offenses).to.have.length(1);
    console.log(offenses[0]);
    expect(offenses[0].message).to.include(
      `Preset block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should not report when all section and block preset settings in the block preset are valid', async () => {
    const theme: MockTheme = {
      'blocks/block_1.liquid': `
        {% schema %}
        {
          "name": "t:names.block_1",
          "settings": [
            {
              "type": "text",
              "id": "block_1_setting_key",
              "label": "t:settings.block_1"
            }
          ]
        }
        {% endschema %}
      `,
      'blocks/price.liquid': `
        {% schema %}
        {
          "name": "t:names.product_price",
          "settings": [
            {
              "type": "product",
              "id": "product",
              "label": "t:settings.product"
            },
            {
              "type": "text",
              "id": "section_setting",
              "label": "t:settings.section"
            }
          ],
          "blocks": [
            {
              "type": "block_1",
              "name": "t:names.block_1"
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": { 
                "product": "{{ context.product }}",
                "section_setting": "some value"
              },
              "blocks": [
                {
                  "block_1": {
                    "type": "block_1",
                    "settings": {
                      "block_1_setting_key": "correct setting key"
                    }
                  }
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidBlockPresetSettings]);
    expect(offenses).to.have.length(0);
  });
});
