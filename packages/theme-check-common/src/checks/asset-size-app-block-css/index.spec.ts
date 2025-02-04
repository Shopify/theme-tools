import { describe, expect, it } from 'vitest';
import { AssetSizeAppBlockCSS } from '.';
import { check, MockTheme } from '../../test';

describe('Module: AssetSizeAppBlockCSS', () => {
  const extensionFiles: MockTheme = {
    'assets/app.css': '* { color: green } ',
    'blocks/app.liquid': `
      {% schema %}
      {
        "stylesheet": "app.css"
      }
      {% endschema %}
    `,
  };

  it('should not report any offenses if CSS is smaller than threshold', async () => {
    const offenses = await check(extensionFiles, [AssetSizeAppBlockCSS]);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if CSS is larger than threshold', async () => {
    const offenses = await check(
      extensionFiles,
      [AssetSizeAppBlockCSS],
      {},
      {
        AssetSizeAppBlockCSS: {
          enabled: true,
          thresholdInBytes: 1,
        },
      },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `The file size for 'app.css' (19 B) exceeds the configured threshold (1 B)`,
      uri: 'file:///blocks/app.liquid',
      start: { index: 51 },
      end: { index: 58 },
    });
  });

  it('should report an offense if the CSS file does not exist', async () => {
    const extensionFiles: MockTheme = {
      'blocks/app.liquid': `
        {% schema %}
        {
          "stylesheet": "nonexistent.css"
        }
        {% endschema %}
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockCSS]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `'nonexistent.css' does not exist.`,
      uri: 'file:///blocks/app.liquid',
      start: { index: 57 },
      end: { index: 72 },
    });
  });

  it('should reports offense if the CSS file does not exist and the asset has a trailing comma', async () => {
    const extensionFiles: MockTheme = {
      'blocks/app.liquid': `
        {% schema %}
        {
          "stylesheet": "nonexistent.css",
        }
        {% endschema %}
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeAppBlockCSS]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: `'nonexistent.css' does not exist.`,
      uri: 'file:///blocks/app.liquid',
      start: { index: 57 },
      end: { index: 72 },
    });
  });
});
