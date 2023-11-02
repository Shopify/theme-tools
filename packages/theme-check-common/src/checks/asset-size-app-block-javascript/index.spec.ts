import { expect, describe, it } from 'vitest';
import { AssetSizeAppBlockJavaScript } from '.';
import { check, MockTheme } from '../../test';
import { SchemaProp } from '../../types';

describe('Module: AssetSizeAppBlockJavaScript', () => {
  const extensionFiles: MockTheme = {
    'assets/app.js': 'console.log("Hello, world!");',
    'blocks/app.liquid': `
      {% schema %}
      {
        "javascript": "app.js"
      }
      {% endschema %}
    `,
  };

  it('should not report any offenses if JavaScript is smaller than threshold', async () => {
    const offenses = await check(extensionFiles, [AssetSizeAppBlockJavaScript]);

    expect(offenses).toHaveLength(0);
  });

  it('should skip the check if context.fileSize is undefined', async () => {
    const context = {
      fileSize: undefined,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockJavaScript], context);
    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if JavaScript is larger than threshold', async () => {
    const CustomAssetSizeAppBlockJavaScript = {
      ...AssetSizeAppBlockJavaScript,
      meta: {
        ...AssetSizeAppBlockJavaScript.meta,
        schema: {
          thresholdInBytes: SchemaProp.number(1),
        },
      },
    };

    const offenses = await check(extensionFiles, [CustomAssetSizeAppBlockJavaScript]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `The file size for 'app.js' (29 B) exceeds the configured threshold (1 B)`,
      absolutePath: '/blocks/app.liquid',
      start: { index: 51 },
      end: { index: 57 },
    });
  });

  it('should report an offense if the JavaScript file does not exist', async () => {
    const extensionFiles: MockTheme = {
      'blocks/app.liquid': `
        {% schema %}
        {
          "javascript": "nonexistent.js"
        }
        {% endschema %}
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockJavaScript]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `'nonexistent.js' does not exist.`,
      absolutePath: '/blocks/app.liquid',
      start: { index: 57 },
      end: { index: 71 },
    });
  });

  it('should not report an offense if the schema is malformed JSON', async () => {
    const extensionFiles: MockTheme = {
      'blocks/app.liquid': `
        {% schema %}
        {
          "javascript": "app.js",
        {% endschema %}
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockJavaScript]);
    expect(offenses).toHaveLength(0);
  });
});
