import { expect, describe, it } from 'vitest';
import { MissingTemplate } from '.';
import { check } from '../../test';

describe('Module: MissingTemplate', () => {
  it('should report missing template errors', async () => {
    const testCases = [
      {
        testCase: 'should report the missing snippet to be rendered with "render"',
        file: `
        {% render 'existing' %}
        {% render 'missing' with foo as arg          %}
        {% render myvariable %}
      `,
        expected: {
          message: "'snippets/missing.liquid' does not exist",
          uri: 'file:///snippets/snippet.liquid',
          start: { index: 51, line: 2, character: 18 },
          end: { index: 60, line: 2, character: 27 },
        },
        filesWith: (file: string) => ({
          'snippets/snippet.liquid': file,
          'snippets/existing.liquid': '',
        }),
      },
      {
        testCase: 'should report the missing snippet to be rendered with "include"',
        file: "{% include 'missing' %}",
        expected: {
          message: "'snippets/missing.liquid' does not exist",
          uri: 'file:///snippets/snippet.liquid',
          start: { index: 11, line: 0, character: 11 },
          end: { index: 20, line: 0, character: 20 },
        },
        filesWith: (file: string) => ({
          'snippets/snippet.liquid': file,
          'snippets/existing.liquid': '',
        }),
      },
      {
        testCase: 'should report the missing section to be rendered with "section"',
        file: "{% section 'missing' %}",
        expected: {
          message: "'sections/missing.liquid' does not exist",
          uri: 'file:///sections/section.liquid',
          start: { index: 11, line: 0, character: 11 },
          end: { index: 20, line: 0, character: 20 },
        },
        filesWith: (file: string) => ({
          'sections/section.liquid': file,
          'sections/existing.liquid': '',
        }),
      },
    ];
    for (const { testCase, file, expected, filesWith } of testCases) {
      const offenses = await check(filesWith(file), [MissingTemplate]);

      expect(offenses).to.have.length(1);
      expect(offenses, testCase).to.containOffense({
        check: MissingTemplate.meta.code,
        ...expected,
      });
    }
  });

  it('ignores missing files if ignored by ignore_missing pattern', async () => {
    const contexts = [
      {
        file: '{% render "ignored" %}',
        ignoreMissing: ['snippets/ignored.liquid'],
      },
      {
        file: '{% render "ignored" %}',
        ignoreMissing: ['snippets/*.liquid'],
      },
      {
        file: '{% render "ignored" %}',
        ignoreMissing: ['*/ignored.liquid'],
      },
      {
        file: '{% section "ignored" %}',
        ignoreMissing: ['sections/ignored.liquid'],
      },
      {
        file: '{% section "ignored" %}',
        ignoreMissing: ['sections/ignored.liquid'],
      },
      {
        file: '{% section "ignored" %}',
        ignoreMissing: ['*/ignored.liquid'],
      },
    ];

    for (const { file, ignoreMissing } of contexts) {
      MissingTemplate;
      const offenses = await check(
        { 'file.liquid': file },
        [MissingTemplate],
        {},
        {
          MissingTemplate: {
            enabled: true,
            ignoreMissing,
          },
        },
      );
      expect(offenses).to.be.empty;
    }
  });
});
