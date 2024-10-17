import { vi, expect, describe, it, afterEach } from 'vitest';
import { AssetSizeCSS } from '.';
import { check, MockTheme } from '../../test';
import { SchemaProp } from '../../types';
import { hasRemoteAssetSizeExceededThreshold } from '../../utils/file-utils';

vi.mock('../../utils/file-utils', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    hasRemoteAssetSizeExceededThreshold: vi.fn(),
  };
});

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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not report any offenses if CSS is smaller than threshold', async () => {
    const offenses = await check(extensionFiles, [AssetSizeCSS]);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if CSS is larger than threshold', async () => {
    const offenses = await check(
      extensionFiles,
      [AssetSizeCSS],
      {},
      {
        AssetSizeCSS: {
          enabled: true,
          thresholdInBytes: 1,
        },
      },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 1 bytes',
      uri: 'file:///templates/index.liquid',
      start: { index: 51 },
      end: { index: 80 },
    });
  });

  it('should report a warning when the CSS file size exceeds the threshold', async () => {
    vi.mocked(hasRemoteAssetSizeExceededThreshold).mockReturnValue(Promise.resolve(true));
    const offenses = await check(
      httpTest,
      [AssetSizeCSS],
      {},
      {
        AssetSizeCSS: {
          enabled: true,
          thresholdInBytes: 1,
        },
      },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 1 bytes',
      uri: 'file:///templates/index.liquid',
      start: { index: 51 },
      end: { index: 122 },
    });
  });

  it('should not report any offenses if CSS is smaller than threshold 2', async () => {
    vi.mocked(hasRemoteAssetSizeExceededThreshold).mockResolvedValue(false);
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
    vi.mocked(hasRemoteAssetSizeExceededThreshold).mockResolvedValue(true);
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

    const offenses = await check(
      extensionFiles,
      [AssetSizeCSS],
      {},
      {
        AssetSizeCSS: {
          enabled: true,
          thresholdInBytes: 2,
        },
      },
    );

    expect(offenses).toHaveLength(2);
    expect(offenses[0]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 2 bytes',
      uri: 'file:///templates/index.liquid',
      start: { index: 48 },
      end: { index: 89 },
    });
    expect(offenses[1]).toMatchObject({
      message: 'The CSS file size exceeds the threshold of 2 bytes',
      uri: 'file:///templates/index.liquid',
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
