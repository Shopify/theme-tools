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
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": { 
                "product": "{{ context.product }}",
                "undefined_setting": "some value",
              }
            }
          ]
        }
        {% endschema %}
      `,
    };
    const offenses = await check(theme, [ValidBlockPresetSettings]);
    expect(offenses).to.have.length(1);
  });

  it('should report invalid theme block preset settings', async () => {
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
            },
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
            }
          ],
          "blocks": [
            {
              "type": "block_1",
              "name": "t:names.block_1",
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": { 
                "product": "{{ context.product }}",
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
              ],
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidBlockPresetSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      'Preset setting "undefined_setting" does not exist in the block type "block_1"\'s settings',
    );
  });

  it('should not report when all section and block preset settings are valid', async () => {
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
