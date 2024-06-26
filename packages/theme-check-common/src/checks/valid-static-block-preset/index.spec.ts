import { expect, describe, it } from 'vitest';
import { check, MockTheme, runLiquidCheck } from '../../test';
import { SchemaProp } from '../../types';

describe('Module: ValidStaticBlockPreset', () => {
  const genericThemeBlock = {
    'blocks/group.liquid': 'Hello world!',
    'blocks/text.liquid': 'Hello world!',
  };

  const validBlockPresets = {
    'blocks/file.liquid': `
    {% content_for "block", type: "group", id: "static-block-1" %}
    {% content_for "block", type: "text", id: "static-block-2" %}
    {% content_for "block", type: "text", id: "static-block-3" %}
    {% schema %}
    {
      "name": "block",
      "presets": [
        {
          "name": "preset-1",
          "blocks": [
            {
              "type": "group",
              "static": true,
              "id": "static-block-1"
            }
          ]
        },
        {
          "name": "preset-2",
          "blocks": [
            {
              "type": "text",
              "static": true,
              "id": "static-block-2"
            },
            {
              "type": "text",
              "static": true,
              "id": "static-block-3"
            }
          ]
        }
      ]
    }
    {% endschema %}
    `,
  };

  const invalidBlockPresetWithNoContentForTag = {
    'blocks/file.liquid': `
    {% schema %}
    {
      "name": "block",
      "presets": [
        {
          "name": "preset-2",
          "blocks": [
            {
              "type": "group",
              "static": true,
              "id": "static-block-2"
            }
          ]
        }
      ]
    }
    {% endschema %}
    `,
  };

  const invalidTypeBlock = {
    'blocks/file.liquid': `
    {% content_for "block", type: "group", id: "static-block-1" %}
    {% content_for "block", type: "text", id: "static-block-2" %}
    {% schema %}
    {
      "name": "block",
      "presets": [
        {
          "name": "preset-1",
          "blocks": [
            {
              "type": "group",
              "static": true,
              "id": "static-block-1"
            }
          ]
        },
        {
          "name": "preset-2",
          "blocks": [
            {
              "type": "random",
              "static": true,
              "id": "static-block-2"
            }
          ]
        }
      ]
    }
    {% endschema %}
    `,
  };

  const validExtensionFiles: MockTheme = {
    ...genericThemeBlock,
    ...validBlockPresets,
  };

  const invalidExtensionFiles: MockTheme = {
    ...genericThemeBlock,
    ...invalidBlockPresetWithNoContentForTag,
  };

  it('should not report any offenses if static block preset matches content_for "block" definition', async () => {
    const offenses = await check(validExtensionFiles);
    console.log(offenses);
    expect(offenses).toHaveLength(0);
  });

  it('should report a offense if type is invalid if static block preset does not match content_for "block" definitio', async () => {
    const offenses = await check(invalidExtensionFiles);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).to.equal(
      "The block preset with ID 'static-block-2' in 'preset-2' does not have corresponding content_for \"block\" reference in the code",
    );
  });
});
