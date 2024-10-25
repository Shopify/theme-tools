import { expect, describe, it, afterEach, vi } from 'vitest';
import { AssetSizeJavaScript } from '.';
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

describe('Module: AssetSizeJavaScript', () => {
  const theme: MockTheme = {
    'assets/theme.js': "console.log('hello world'); console.log('Oh. Hi Mark!')",
    'templates/index.liquid': `
      <html>
        <head>
          <script src="{{ 'theme.js' | asset_url }}" defer></script>
        </head>
      </html>
    `,
  };

  const httpTest: MockTheme = {
    'templates/index.liquid': `
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.min.js" defer></script>
        </head>
      </html>
    `,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not find file size for invalid URLs', async () => {
    const invalidUrls = [
      'https://{{ settings.url }}',
      "{{ 'this_file_does_not_exist.js' | asset_url }}",
      '{% if on_product %}https://hello.world{% else %}https://hi.world{% endif %}',
    ];

    for (const url of invalidUrls) {
      const offenses = await check(
        { 'templates/index.liquid': `<script src="${url}" defer></script>` },
        [AssetSizeJavaScript],
      );
      expect(offenses).toHaveLength(0);
    }
  });

  it('should report a warning when the JavaScript http request exceeds the threshold', async () => {
    vi.mocked(hasRemoteAssetSizeExceededThreshold).mockReturnValue(Promise.resolve(true));
    const offenses = await check(
      httpTest,
      [AssetSizeJavaScript],
      {},
      {
        AssetSizeJavaScript: {
          enabled: true,
          thresholdInBytes: 1,
        },
      },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message:
        'JavaScript on every page load exceeds compressed size threshold (1 Bytes), consider using the import on interaction pattern.',
      uri: 'file:///templates/index.liquid',
      start: { index: 52 },
      end: { index: 121 },
    });
  });

  it('should not report any offenses if JavaScript is smaller than threshold', async () => {
    const offenses = await check(theme, [AssetSizeJavaScript]);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if JavaScript is larger than threshold', async () => {
    const offenses = await check(
      theme,
      [AssetSizeJavaScript],
      {},
      {
        AssetSizeJavaScript: {
          enabled: true,
          thresholdInBytes: 2,
        },
      },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      message:
        'JavaScript on every page load exceeds compressed size threshold (2 Bytes), consider using the import on interaction pattern.',
      uri: 'file:///templates/index.liquid',
      start: { index: 52 },
      end: { index: 80 },
    });
  });

  it('should not report any offenses for inline JavaScript', async () => {
    const inlineTheme: MockTheme = {
      'templates/index.liquid': `
        <html>
          <head>
            <script>
              console.log('hello world');
            </script>
          </head>
        </html>
      `,
    };

    const offenses = await check(inlineTheme, [AssetSizeJavaScript]);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if JS is larger than threshold', async () => {
    const extensionFiles: MockTheme = {
      'assets/theme.js': 'console.log("hello world");',
      'templates/index.liquid': `
        <html>
          <head>
            {{ 'theme.js' | asset_url | script_tag }}
            {{ "https://example.com" | script_tag }}
          </head>
        </html>
      `,
    };

    const offenses = await check(
      extensionFiles,
      [AssetSizeJavaScript],
      {},
      {
        AssetSizeJavaScript: {
          enabled: true,
          thresholdInBytes: 2,
        },
      },
    );

    expect(offenses).toHaveLength(2);
    expect(offenses[0]).toMatchObject({
      message:
        'JavaScript on every page load exceeds compressed size threshold (2 Bytes), consider using the import on interaction pattern.',
      uri: 'file:///templates/index.liquid',
      start: { index: 48 },
      end: { index: 84 },
    });
    expect(offenses[1]).toMatchObject({
      message:
        'JavaScript on every page load exceeds compressed size threshold (2 Bytes), consider using the import on interaction pattern.',
      uri: 'file:///templates/index.liquid',
      start: { index: 102 },
      end: { index: 123 },
    });
  });

  it('should not report any offenses if there is no javascript', async () => {
    const extensionFiles: MockTheme = {
      'templates/index.liquid': `
        <html>
          <head>
          </head>
        </html>
      `,
    };

    const offenses = await check(extensionFiles, [AssetSizeJavaScript]);

    expect(offenses).toHaveLength(0);
  });
});
