import { expect } from 'chai';
import { MissingTemplate } from '.';
import { check } from '../../test';

describe('Module: MissingTemplate', () => {
  [
    {
      testCase: 'should report the missing snippet to be rendered with "render"',
      file: `
        {% render 'existing' %}
        {% render 'missing' with foo as arg          %}
        {% render myvariable %}
      `,
      expected: {
        message: "'snippets/missing.liquid' does not exist",
        absolutePath: '/snippets/snippet.liquid',
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
        absolutePath: '/snippets/snippet.liquid',
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
        absolutePath: '/sections/section.liquid',
        start: { index: 11, line: 0, character: 11 },
        end: { index: 20, line: 0, character: 20 },
      },
      filesWith: (file: string) => ({
        'sections/section.liquid': file,
        'sections/existing.liquid': '',
      }),
    },
  ].forEach(({ testCase, file, expected, filesWith }) => {
    it(testCase, async () => {
      const offenses = await check(filesWith(file), [MissingTemplate]);

      expect(offenses).to.have.length(1);
      expect(offenses).to.containOffense({
        check: MissingTemplate.meta.code,
        ...expected,
      });
    });
  });
});
