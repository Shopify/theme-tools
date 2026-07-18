import { expect, describe, it } from 'vitest';
import { runLiquidCheck } from '../../test';
import { DiscourageSectionBlocks } from './index';

const sectionFile = 'sections/my-section.liquid';

describe('Module: DiscourageSectionBlocks', () => {
  it('reports a section block', async () => {
    const source = `
      {% schema %}
      {
        "name": "My Section",
        "blocks": [
          {
            "type": "text",
            "name": "Text",
            "settings": [
              { "type": "text", "id": "content", "label": "Content" }
            ]
          }
        ]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DiscourageSectionBlocks, source, sectionFile);

    expect(offenses).toHaveLength(1);
  });

  it('reports each section block independently', async () => {
    const source = `
      {% schema %}
      {
        "name": "My Section",
        "blocks": [
          {
            "type": "text",
            "name": "Text",
            "settings": []
          },
          {
            "type": "image",
            "name": "Image",
            "settings": []
          }
        ]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DiscourageSectionBlocks, source, sectionFile);

    expect(offenses).toHaveLength(2);
  });

  it('does not report theme blocks', async () => {
    const source = `
      {% schema %}
      {
        "name": "My Section",
        "blocks": [
          { "type": "@app" }
        ]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DiscourageSectionBlocks, source, sectionFile);

    expect(offenses).toHaveLength(0);
  });

  it('does not report when there are no blocks', async () => {
    const source = `
      {% schema %}
      {
        "name": "My Section",
        "settings": []
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DiscourageSectionBlocks, source, sectionFile);

    expect(offenses).toHaveLength(0);
  });

  it('does not report when the schema tag is missing', async () => {
    const source = `<div>No schema here</div>`;

    const offenses = await runLiquidCheck(DiscourageSectionBlocks, source, sectionFile);

    expect(offenses).toHaveLength(0);
  });

  it('reports section blocks but not theme blocks when mixed', async () => {
    const source = `
      {% schema %}
      {
        "name": "My Section",
        "blocks": [
          { "type": "@app" },
          {
            "type": "text",
            "name": "Text",
            "settings": []
          }
        ]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DiscourageSectionBlocks, source, sectionFile);

    expect(offenses).toHaveLength(1);
  });

  it('does not report for non-section files', async () => {
    const source = `
      {% schema %}
      {
        "name": "My Block",
        "settings": [
          {
            "type": "text",
            "id": "content",
            "label": "Content"
          }
        ]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(
      DiscourageSectionBlocks,
      source,
      'blocks/my-block.liquid',
    );

    expect(offenses).toHaveLength(0);
  });
});
