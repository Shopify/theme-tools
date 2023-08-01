import { describe, expect, it } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { MatchingSchemaTranslations } from './index';

describe('MatchingSchemaTranslations', () => {
  it('should not report offenses for schema without translations', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": "Hello",
          "settings": [
            {
              "id": "product",
              "label": "Product"
            }
          ]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(MatchingSchemaTranslations, sourceCode);
    expect(offenses).toHaveLength(0);
  });

  it('should not report offenses for matching translations', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": {
            "en": "Hello",
            "fr": "Bonjour"
          },
          "settings": [
            {
              "id": "product",
              "label": {
                "en": "Product",
                "fr": "Produit"
              }
            }
          ]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(MatchingSchemaTranslations, sourceCode);
    expect(offenses).to.have.length(0);
  });

  it('should report offenses for missing translations', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": {
            "en": "Hello",
            "fr": "Bonjour"
          },
          "settings": [
            {
              "id": "product",
              "label": {
                "en": "Product"
              }
            }
          ]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(MatchingSchemaTranslations, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('settings.product.label missing translations for fr');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['{% schema %}']);
  });
});
