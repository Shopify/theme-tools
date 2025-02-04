import { describe, expect, it } from 'vitest';
import { AssetSizeAppBlockJavaScript } from '.';
import { check, MockTheme } from '../../test';

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

  it('should report an offense if JavaScript is larger than threshold', async () => {
    const offenses = await check(
      extensionFiles,
      [AssetSizeAppBlockJavaScript],
      {},
      {
        AssetSizeAppBlockJavaScript: {
          enabled: true,
          thresholdInBytes: 1,
        },
      },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `The file size for 'app.js' (29 B) exceeds the configured threshold (1 B)`,
      uri: 'file:///blocks/app.liquid',
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
      uri: 'file:///blocks/app.liquid',
      start: { index: 57 },
      end: { index: 71 },
    });
  });
});
