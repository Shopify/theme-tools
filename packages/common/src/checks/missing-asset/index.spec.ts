import { expect, describe, it } from 'vitest';
import { MissingAsset } from '.';
import { check } from '../../test';

describe('Module: MissingAsset', () => {
  [
    {
      testCase: 'should report the missing asset when assigned to a variable',
      file: `
      {% assign logo_url = 'logo.png' | asset_url %}
      <img src="{{ logo_url }}" alt="Logo" />
      `,
      expected: {
        message: "'assets/logo.png' does not exist",
        absolutePath: '/snippets/snippet.liquid',
        start: { index: 28, line: 1, character: 27 },
        end: { index: 38, line: 1, character: 37 },
      },
      filesWith: (file: string) => ({
        'snippets/snippet.liquid': file,
        'snippets/existing.liquid': '',
      }),
    },
    {
      testCase: 'should report the missing asset when defined inline',
      file: `
      <link rel="stylesheet" href="{{ 'styles.css' | asset_url }}" />
      `,
      expected: {
        message: "'assets/styles.css' does not exist",
        absolutePath: '/snippets/snippet.liquid',
        start: { index: 39, line: 1, character: 38 },
        end: { index: 51, line: 1, character: 50 },
      },
      filesWith: (file: string) => ({
        'snippets/snippet.liquid': file,
        'snippets/existing.liquid': '',
      }),
    },
    {
      testCase: 'should report the missing asset when multiple filters applied',
      file: `
      <link rel="stylesheet" href="{{ 'styles.css' | asset_url | stylesheet_tag}}" />
      `,
      expected: {
        message: "'assets/styles.css' does not exist",
        absolutePath: '/snippets/snippet.liquid',
        start: { index: 39, line: 1, character: 38 },
        end: { index: 51, line: 1, character: 50 },
      },
      filesWith: (file: string) => ({
        'snippets/snippet.liquid': file,
        'snippets/existing.liquid': '',
      }),
    },
  ].forEach(({ testCase, file, expected, filesWith }) => {
    it(testCase, async () => {
      const offenses = await check(filesWith(file), [MissingAsset]);

      expect(offenses).to.have.length(1);
      expect(offenses).to.containOffense({
        check: MissingAsset.meta.code,
        ...expected,
      });
    });
  });

  it('should report no offenses when an asset file exists', async () => {
    const filesWith = (file: string) => ({
      'snippets/snippet.liquid': file,
      'assets/styles.css': '',
    });
    const file = `<link rel="stylesheet" href="{{ 'styles.css' | asset_url }}" />`

    const offenses = await check(filesWith(file), [MissingAsset]);

    expect(offenses).to.have.length(0);
  });
});
