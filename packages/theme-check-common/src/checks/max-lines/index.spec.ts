import { expect, describe, it } from 'vitest';
import { runLiquidCheck, check } from '../../test';
import { MaxLines } from './index';

const sectionFile = 'sections/my-section.liquid';

describe('Module: MaxLines', () => {
  it('does not report when file is within the default limit', async () => {
    const source = Array(300).fill('<div></div>').join('\n');
    const offenses = await runLiquidCheck(MaxLines, source, sectionFile);
    expect(offenses).toHaveLength(0);
  });

  it('reports when file exceeds the default limit', async () => {
    const source = Array(301).fill('<div></div>').join('\n');
    const offenses = await runLiquidCheck(MaxLines, source, sectionFile);
    expect(offenses).toHaveLength(1);
    expect(offenses.at(0)?.message).toMatch(/301.*300/);
  });

  it('reports with a custom max', async () => {
    const source = Array(6).fill('<div></div>').join('\n');
    const offenses = await check(
      { [sectionFile]: source },
      [MaxLines],
      {},
      { MaxLines: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(1);
    expect(offenses.at(0)?.message).toMatch(/6.*5/);
  });

  it('does not report when file equals the max', async () => {
    const source = Array(5).fill('<div></div>').join('\n');
    const offenses = await check(
      { [sectionFile]: source },
      [MaxLines],
      {},
      { MaxLines: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('reports the offset at the first excess line', async () => {
    const line1 = '<div>line1</div>';
    const line2 = '<div>line2</div>';
    const line3 = '<div>line3</div>';
    const source = [line1, line2, line3].join('\n');
    const offenses = await check(
      { [sectionFile]: source },
      [MaxLines],
      {},
      { MaxLines: { enabled: true, max: 2 } },
    );
    expect(offenses).toHaveLength(1);
    expect(offenses.at(0)?.start.index).toBe(line1.length + 1 + line2.length + 1);
  });

  describe('skipBlankLines', () => {
    it('counts blank lines by default', async () => {
      const source = Array(3).fill('<div></div>').join('\n\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 4 } },
      );
      expect(offenses).toHaveLength(1);
    });

    it('skips blank lines when enabled', async () => {
      const source = Array(3).fill('<div></div>').join('\n\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 4, skipBlankLines: true } },
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('skipComments', () => {
    it('counts liquid comment lines by default', async () => {
      const source = [
        '<div></div>',
        '{% comment %}',
        'This is a comment',
        '{% endcomment %}',
        '<div></div>',
      ].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 4 } },
      );
      expect(offenses).toHaveLength(1);
    });

    it('skips liquid comment blocks when enabled', async () => {
      const source = [
        '<div></div>',
        '{% comment %}',
        'This is a comment',
        '{% endcomment %}',
        '<div></div>',
      ].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 4, skipComments: true } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('skips liquid comment blocks with dash syntax', async () => {
      const source = [
        '<div></div>',
        '{%- comment -%}',
        'This is a comment',
        '{%- endcomment -%}',
        '<div></div>',
      ].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipComments: true } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('skips HTML comment lines when enabled', async () => {
      const source = ['<div></div>', '<!-- this is a comment -->', '<div></div>'].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipComments: true } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('skips inline liquid comment blocks', async () => {
      const source = ['<div></div>', '{% comment %}inline{% endcomment %}', '<div></div>'].join(
        '\n',
      );
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipComments: true } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('skips {% # inline %} comments', async () => {
      const source = ['<div></div>', '{% # this is an inline comment %}', '<div></div>'].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipComments: true } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('skips {%- # inline -%} comments with dash syntax', async () => {
      const source = ['<div></div>', '{%- # this is an inline comment -%}', '<div></div>'].join(
        '\n',
      );
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipComments: true } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('counts {% # inline %} comments when skipComments is false', async () => {
      const source = ['<div></div>', '{% # this is an inline comment %}', '<div></div>'].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2 } },
      );
      expect(offenses).toHaveLength(1);
    });
  });

  describe('skipSchema', () => {
    it('skips schema block by default', async () => {
      const source = ['<div></div>', '{% schema %}', '{}', '{% endschema %}', '<div></div>'].join(
        '\n',
      );
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2 } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('counts schema lines when skipSchema is false', async () => {
      const source = ['<div></div>', '{% schema %}', '{}', '{% endschema %}', '<div></div>'].join(
        '\n',
      );
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipSchema: false } },
      );
      expect(offenses).toHaveLength(1);
    });

    it('skips schema block with dash syntax', async () => {
      const source = [
        '<div></div>',
        '{%- schema -%}',
        '{}',
        '{%- endschema -%}',
        '<div></div>',
      ].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2 } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('skips start and end tags as well as inner content', async () => {
      const source = [
        '<div></div>',
        '{% schema %}',
        '{ "name": "My section",',
        '  "settings": [] }',
        '{% endschema %}',
        '<div></div>',
      ].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2 } },
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('skipDoc', () => {
    it('skips doc block by default', async () => {
      const source = ['<div></div>', '{% doc %}', 'Some docs', '{% enddoc %}', '<div></div>'].join(
        '\n',
      );
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2 } },
      );
      expect(offenses).toHaveLength(0);
    });

    it('counts doc block lines when skipDoc is false', async () => {
      const source = ['<div></div>', '{% doc %}', 'Some docs', '{% enddoc %}', '<div></div>'].join(
        '\n',
      );
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 4, skipDoc: false } },
      );
      expect(offenses).toHaveLength(1);
    });

    it('skips doc block with dash syntax', async () => {
      const source = [
        '<div></div>',
        '{%- doc -%}',
        'Some docs',
        '{%- enddoc -%}',
        '<div></div>',
      ].join('\n');
      const offenses = await check(
        { [sectionFile]: source },
        [MaxLines],
        {},
        { MaxLines: { enabled: true, max: 2, skipDoc: true } },
      );
      expect(offenses).toHaveLength(0);
    });
  });
});
