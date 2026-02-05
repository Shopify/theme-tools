import { expect, describe, it } from 'vitest';
import { highlightedOffenses, check } from '../../test';
import { ValidSchemaTranslations } from './index';

describe('Module: ValidSchemaTranslations', () => {
  it('reports no offense when schema has no translation keys', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': '{}',
        'sections/file.liquid': `
          {% schema %}
            {
              "name": "My Section",
              "settings": [
                {
                  "type": "text",
                  "id": "title",
                  "label": "Title"
                }
              ]
            }
          {% endschema %}`,
      },
      [ValidSchemaTranslations],
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports no offense when all translation keys exist', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': JSON.stringify({
          sections: {
            header: {
              name: 'Header',
              settings: {
                title: {
                  label: 'Title',
                  info: 'Enter a title',
                },
              },
            },
          },
        }),
        'sections/file.liquid': `
          {% schema %}
            {
              "name": "t:sections.header.name",
              "settings": [
                {
                  "type": "text",
                  "id": "title",
                  "label": "t:sections.header.settings.title.label",
                  "info": "t:sections.header.settings.title.info"
                }
              ]
            }
          {% endschema %}`,
      },
      [ValidSchemaTranslations],
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense when a translation key is missing', async () => {
    const themeFiles = {
      'locales/en.default.schema.json': JSON.stringify({
        sections: {
          header: {
            name: 'Header',
          },
        },
      }),
      'sections/file.liquid': `
          {% schema %}
            {
              "name": "t:sections.header.missing_key"
            }
          {% endschema %}`,
    };

    const offenses = await check(themeFiles, [ValidSchemaTranslations]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "'t:sections.header.missing_key' does not have a matching entry in 'locales/en.default.schema.json'",
    );

    const highlights = highlightedOffenses(themeFiles, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('"t:sections.header.missing_key"');
  });

  it('reports multiple offenses when multiple translation keys are missing', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': JSON.stringify({
          sections: {
            header: {
              name: 'Header',
            },
          },
        }),
        'sections/file.liquid': `
          {% schema %}
            {
              "name": "t:sections.header.name",
              "settings": [
                {
                  "type": "text",
                  "id": "title",
                  "label": "t:sections.header.settings.title.label",
                  "info": "t:sections.header.settings.title.info"
                }
              ]
            }
          {% endschema %}`,
      },
      [ValidSchemaTranslations],
    );

    expect(offenses).toHaveLength(2);
    expect(offenses[0].message).toEqual(
      "'t:sections.header.settings.title.label' does not have a matching entry in 'locales/en.default.schema.json'",
    );
    expect(offenses[1].message).toEqual(
      "'t:sections.header.settings.title.info' does not have a matching entry in 'locales/en.default.schema.json'",
    );
  });

  it('reports offense for missing translation in nested arrays', async () => {
    const themeFiles = {
      'locales/en.default.schema.json': JSON.stringify({
        sections: {
          header: {
            name: 'Header',
          },
        },
      }),
      'sections/file.liquid': `
          {% schema %}
            {
              "name": "t:sections.header.name",
              "blocks": [
                {
                  "type": "text",
                  "name": "t:sections.header.blocks.text.name"
                }
              ]
            }
          {% endschema %}`,
    };

    const offenses = await check(themeFiles, [ValidSchemaTranslations]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "'t:sections.header.blocks.text.name' does not have a matching entry in 'locales/en.default.schema.json'",
    );
  });

  it('reports no offense when schema is invalid JSON', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': '{}',
        'sections/file.liquid': `
          {% schema %}
            { invalid json }
          {% endschema %}`,
      },
      [ValidSchemaTranslations],
    );

    expect(offenses).toHaveLength(0);
  });
});
