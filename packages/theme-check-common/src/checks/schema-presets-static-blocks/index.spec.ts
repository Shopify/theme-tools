import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck, check } from '../../test';
import { SchemaPresetsStaticBlocks } from './index';

const DEFAULT_FILE_NAME = 'sections/file.liquid';

describe('Module: SchemaPresetsStaticBlocks', () => {
  it('reports no errors when there are {% content_for "block" ... %} for each static block in the preset blocks array', async () => {
    const sourceCode = `
      {% content_for "block-1" %}
      {% content_for "block-2" %}
      {% schema %}
      {
        "name": "Test section",
        "blocks": [{"type": "@theme"}],
        "presets": [
          {
            "name": "Preset with two static blocks",
            "blocks": [
              {
                "type": "text",
                "static": true,
                "id": "block-1"
              },
              {
                "type": "icon",
                "static": true,
                "id": "block-2"
              }
            ]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsStaticBlocks, sourceCode, DEFAULT_FILE_NAME);
    console.log(offenses);
    expect(offenses).toHaveLength(0);
  });

  it('reports an error when there are {% content_for "block" ... %} missing for static blocks in the preset blocks array', async () => {
    const sourceCode = `
      {% content_for "block-1" %}
      {% comment %} here we are missing the other content_for block for block-2 {% endcomment %}
      {% schema %}
      {
        "name": "Test section",
        "blocks": [{"type": "@theme"}],
        "presets": [
          {
            "name": "Preset with two static blocks",
            "blocks": [
              {
                "type": "text",
                "static": true,
                "id": "block-1"
              },
              {
                "type": "icon",
                "static": true,
                "id": "block-2"
              }
            ]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsStaticBlocks, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual("block 'nested-2' is missing from the block_order");

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('["nested-1"]');
  });
});
