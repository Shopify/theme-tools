import { describe, expect, it } from 'vitest';
import { runLiquidCheck } from '../../test';
import { MissingSchema } from './index';
import { Config } from '../../types';

describe('MissingSchema', () => {
  it('should report an error when schema tag is missing on a theme app extension', async () => {
    const sourceCode = `
      <footer class="footer">
        {% for block in section.blocks %}
          {% case block.type %}
            {% when 'link' %}
              <div class="link" {{ block.shopify_attributes }}>
                {{ block.settings.linktext | link_to: block.settings.linkurl }}
              </div>

            {% when 'custom-text' %}
              <div class="text" {{ block.shopify_attributes }}>
                {{ block.settings.custom-text-field }}
              </div>
          {% endcase %}
        {% endfor %}
      </footer>
    `;

    const offenses = await runLiquidCheck(MissingSchema, sourceCode);
    expect(offenses).to.have.lengthOf(1);
  });

  it('should not report when the schema is present on a theme app extension', async () => {
    const sourceCode = `
<footer class="footer">
  {% for block in section.blocks %}
    {% case block.type %}
      {% when 'link' %}
        <div class="link" {{ block.shopify_attributes }}>
          {{ block.settings.linktext | link_to: block.settings.linkurl }}
        </div>

      {% when 'custom-text' %}
        <div class="text" {{ block.shopify_attributes }}>
          {{ block.settings.custom-text-field }}
        </div>
    {% endcase %}
  {% endfor %}
</footer>

{% schema %}
{
  "name": "Footer",
  "max_blocks": 8,
  "blocks": [
    {
      "type": "link",
      "name": "Link",
      "settings": [
        {
          "id": "linkurl",
          "type": "url",
          "label": "URL link"
        },
        {
          "id": "linktext",
          "type": "text",
          "label": "Link text"
        }
      ]
    },
    {
      "type": "custom-text",
      "name": "Custom Text",
      "settings": [
        {
          "id": "custom-text-field",
          "type": "textarea",
          "label": "Text"
        }
      ]
    }
  ]
}
{% endschema %}`;

    const offenses = await runLiquidCheck(MissingSchema, sourceCode);
    expect(offenses).to.have.lengthOf(0);
  });
});
