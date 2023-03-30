import { expect } from 'chai';
import { MissingTemplate } from '.';
import { check as reportOffenses } from '../../test-helper';

describe('Module: MissingTemplate', () => {
  [
    {
      testCase: 'should report the missing snippet to be rendered with "render"',
      file: `
        {% render 'existing' %}
        {% render 'missing' with foo as arg          %}
        {% render myvariable %}
      `,
      filesWith: (file: string) => ({
        'snippets/snippet.liquid': file,
        'snippets/existing.liquid': '',
      }),
    },
    {
      testCase: 'should report the missing snippet to be rendered with "include"',
      file: "{% include 'missing' %}",
      filesWith: (file: string) => ({
        'snippets/snippet.liquid': file,
        'snippets/existing.liquid': '',
      }),
    },
    {
      testCase: 'should report the missing section to be rendered with "section"',
      file: "{% section 'missing' %}",
      filesWith: (file: string) => ({
        'sections/section.liquid': file,
        'sections/existing.liquid': '',
      }),
    },
  ].forEach(({ testCase, file, filesWith }) => {
    it(testCase, async () => {
      const needle = "'missing'";
      const startIndex = file.indexOf(needle);
      const endIndex = file.indexOf(needle) + needle.length;

      const offenses = await reportOffenses(filesWith(file), [MissingTemplate]);

      expect(offenses).to.have.length(1);
      const { check, message, start, end } = offenses[0];
      expect(check).to.equal(MissingTemplate.meta.code);
      expect(message).to.equal("'missing.liquid' is not found");
      expect(start.index).to.equal(startIndex);
      expect(end.index).to.equal(endIndex);
    });
  });
});
