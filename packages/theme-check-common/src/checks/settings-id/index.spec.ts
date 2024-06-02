import { expect, describe, it } from 'vitest';
import { SettingsId } from '.';
import { check } from '../../test';

const liquidSchema = `
{% schema %}
  {
    "name": "Simple Banner Section",
    "settings": [
      {
        "type": "select",
        "id": "show_subtext",
        "label": "Show Subtext",
        "default": "yes",
        "options": [
          { "value": "yes", "label": "Yes" },
          { "value": "no", "label": "No" }
        ]
      },
      {
        "type": "image_picker",
        "id": "image",
        "label": "Banner Image"
      },
      {
        "type": "select",
        "id": "ratio",
        "label": "Image Ratio",
        "default": "auto",
        "options": [
          { "value": "auto", "label": "Auto" },
          { "value": "1", "label": "1:1 (Square)" },
          { "value": "1.78", "label": "16:9 (Widescreen)" }
        ]
      }
    ]
  }
{% endschema %}
`

const liquidHtml = `
<div>
  {% if section.settings.show_subtext == 'yes' %}
   <p>We're glad you're here. Enjoy browsing our products.</p>
  {% endif %}
 
  {% if block.settings.image %}
   {{ section.settings.image | image_url: width: 3840 | image_tag: width: block.settings.image.width, widths: '375, 550, 750, 1100, 1500, 1780, 2000, 3000, 3840' }}
  {% else %}
   <div class="placeholder-image" style="aspect-ratio:{{ section.settings.ratio == 'auto' ? '1' : block.settings.ratio }};">
    {{ 'detailed-apparel-1' | placeholder_svg_tag: 'image-placeholder-svg' }}
   </div>
  {% endif %}
</div>
`

describe('Module: SettingsId', () => {
  it("should report when a local settings id doesn't exist within a section with schema defined first", async () => {
    const file = `${liquidSchema} ${liquidHtml}`;

    const files = { 'sections/test-section.liquid': file };

    const offenses = await check(files, [SettingsId]);

    expect(offenses).to.have.length(4);
    expect(offenses).to.containOffense({
      check: SettingsId.meta.code,
      message: "Local settings path is invalid. It should start with 'section.settings'.",
      absolutePath: '/sections/test-section.liquid',
    });
  });

  it("should report when a local settings id doesn't exist within a section with schema defined last", async () => {
    const file = `${liquidHtml} ${liquidSchema}`;

    const files = { 'sections/test-section.liquid': file };

    const offenses = await check(files, [SettingsId]);

    console.log("offenses", offenses)
    expect(offenses).to.have.length(4);
    expect(offenses).to.containOffense({
      check: SettingsId.meta.code,
      message: "Local settings path is invalid. It should start with 'section.settings'.",
      absolutePath: '/sections/test-section.liquid',
    });
  });

});
