import { describe, expect, it } from 'vitest';
import { ValidSectionPresetSettings } from '.';
import { check } from '../../test/test-helper';
import { MockTheme } from '../../test/MockTheme';

describe('ValidSectionPresetSettings', () => {
    it('should report invalid preset settings', async () => {
        const theme: MockTheme = {
          'sections/price.liquid': `
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
        const offenses = await check(theme, [ValidSectionPresetSettings]);
        expect(offenses).to.have.length(1);
      });
});
