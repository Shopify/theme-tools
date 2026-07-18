import { expect, describe, it } from 'vitest';
import { check } from '../../test';
import { MaxSchemaSettings } from './index';

const sectionFile = 'sections/my-section.liquid';
const blockFile = 'blocks/my-block.liquid';

function makeSchema(settings: object[]): string {
  return [
    '<div></div>',
    '{% schema %}',
    JSON.stringify({ name: 'My section', settings }),
    '{% endschema %}',
  ].join('\n');
}

function makeSetting(id: string, type = 'text'): object {
  return { type, id, label: id };
}

describe('Module: MaxSchemaSettings', () => {
  it('does not report when settings are within the default limit', async () => {
    const settings = Array.from({ length: 20 }, (_, i) => makeSetting(`setting_${i}`));
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('reports when settings exceed the default limit', async () => {
    const settings = Array.from({ length: 21 }, (_, i) => makeSetting(`setting_${i}`));
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true } },
    );
    expect(offenses).toHaveLength(1);
    expect(offenses.at(0)?.message).toMatch(/21.*20/);
  });

  it('reports with a custom max', async () => {
    const settings = Array.from({ length: 6 }, (_, i) => makeSetting(`setting_${i}`));
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(1);
    expect(offenses.at(0)?.message).toMatch(/6.*5/);
  });

  it('does not report when settings equal the max', async () => {
    const settings = Array.from({ length: 5 }, (_, i) => makeSetting(`setting_${i}`));
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('does not count header settings', async () => {
    const settings = [
      { type: 'header', content: 'Section heading' },
      ...Array.from({ length: 5 }, (_, i) => makeSetting(`setting_${i}`)),
    ];
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('does not count paragraph settings', async () => {
    const settings = [
      { type: 'paragraph', content: 'Some description text.' },
      ...Array.from({ length: 5 }, (_, i) => makeSetting(`setting_${i}`)),
    ];
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('does not count multiple headers and paragraphs', async () => {
    const settings = [
      { type: 'header', content: 'Group 1' },
      makeSetting('text_1'),
      makeSetting('text_2'),
      { type: 'paragraph', content: 'Note about group 2' },
      { type: 'header', content: 'Group 2' },
      makeSetting('text_3'),
    ];
    const offenses = await check(
      { [sectionFile]: makeSchema(settings) },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 3 } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('reports on block files', async () => {
    const settings = Array.from({ length: 6 }, (_, i) => makeSetting(`setting_${i}`));
    const source = [
      '{% schema %}',
      JSON.stringify({ name: 'My block', settings }),
      '{% endschema %}',
    ].join('\n');
    const offenses = await check(
      { [blockFile]: source },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(1);
    expect(offenses.at(0)?.message).toMatch(/6.*5/);
  });

  it('does not report on non-section/block files', async () => {
    const settings = Array.from({ length: 6 }, (_, i) => makeSetting(`setting_${i}`));
    const source = [
      '{% schema %}',
      JSON.stringify({ name: 'Not a section', settings }),
      '{% endschema %}',
    ].join('\n');
    const offenses = await check(
      { 'snippets/my-snippet.liquid': source },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 5 } },
    );
    expect(offenses).toHaveLength(0);
  });

  it('does not report when schema has no settings', async () => {
    const source = [
      '<div></div>',
      '{% schema %}',
      JSON.stringify({ name: 'My section' }),
      '{% endschema %}',
    ].join('\n');
    const offenses = await check(
      { [sectionFile]: source },
      [MaxSchemaSettings],
      {},
      { MaxSchemaSettings: { enabled: true, max: 0 } },
    );
    expect(offenses).toHaveLength(0);
  });
});
