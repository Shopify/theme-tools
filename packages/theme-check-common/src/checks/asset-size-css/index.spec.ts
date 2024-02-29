import { expect, describe, it } from 'vitest';
import { AssetSizeCSS } from '.';
import { check, MockTheme } from '../../test';
import { SchemaProp } from '../../types';

describe('Module: AssetSizeCSS', () => {
  const extensionFiles: MockTheme = {
    'assets/theme.css': '* { color: green !important; }',
    'templates/index.liquid': `
      <html>
        <head>
          <link href="{{ 'theme.css' | asset_url }}" rel="stylesheet">
        </head>
      </html>
    `,
  };

  const httpTest: MockTheme = {
    'templates/index.liquid': `
      <html>
        <head>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
      </html>
    `,
  };

  it('should not report any offenses if CSS is smaller than threshold', async () => {
    const offenses = await check(extensionFiles, [AssetSizeCSS]);

    expect(offenses).toHaveLength(0);
  });

  it('should skip the check if context.fileSize is undefined', async () => {
    const context = {
      fileSize: undefined,
    };

    const offenses = await check(extensionFiles, [AssetSizeCSS], context);
    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if CSS is larger than threshold', async () => {
    const CustomAssetSizeCSS = {
      ...AssetSizeCSS,
      meta: {
        ...AssetSizeCSS.meta,
        schema: {
          thresholdInBytes: SchemaProp.number(1),
        },
      },
    };

    const offenses = await check(extensionFiles, [CustomAssetSizeCSS]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 1 bytes',
      absolutePath: '/templates/index.liquid',
      start: { index: 51 },
      end: { index: 80 },
    });
  });

  it('should report a warning when the CSS file size exceeds the threshold', async () => {
    const CustomAssetSizeCSS = {
      ...AssetSizeCSS,
      meta: {
        ...AssetSizeCSS.meta,
        schema: {
          thresholdInBytes: SchemaProp.number(1),
        },
      },
    };
    const offenses = await check(httpTest, [CustomAssetSizeCSS]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 1 bytes',
      absolutePath: '/templates/index.liquid',
      start: { index: 51 },
      end: { index: 122 },
    });
  });

  it('should not report any offenses if CSS is smaller than threshold 2', async () => {
    const extensionFiles: MockTheme = {
      'assets/theme.css': 'console.log("hello world");',
      'templates/index.liquid': `
        <html>
          <head>
            {{ 'theme.css' | asset_url | stylesheet_tag }}
            {{ "https://example.com" | stylesheet_tag }}
          </head>
        </html>
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeCSS]);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if CSS is larger than threshold 2', async () => {
    const extensionFiles: MockTheme = {
      'assets/theme.css': 'console.log("hello world");',
      'templates/index.liquid': `
        <html>
          <head>
            {{ 'theme.css' | asset_url | stylesheet_tag }}
            {{ "https://example.com" | stylesheet_tag }}
          </head>
        </html>
      `,
    };

    const CustomAssetSizeCSS = {
      ...AssetSizeCSS,
      meta: {
        ...AssetSizeCSS.meta,
        schema: {
          thresholdInBytes: SchemaProp.number(2),
        },
      },
    };

    const offenses = await check(extensionFiles, [CustomAssetSizeCSS]);

    expect(offenses).toHaveLength(2);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 2 bytes',
      absolutePath: '/templates/index.liquid',
      start: { index: 48 },
      end: { index: 89 },
    });
    expect(offenses[1]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 2 bytes',
      absolutePath: '/templates/index.liquid',
      start: { index: 107 },
      end: { index: 128 },
    });
  });

  it('should not report any offenses if there is no stylesheet', async () => {
    const extensionFiles: MockTheme = {
      'templates/index.liquid': `
        <html>
          <head>
          </head>
        </html>
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeCSS]);

    expect(offenses).toHaveLength(0);
  });
});
