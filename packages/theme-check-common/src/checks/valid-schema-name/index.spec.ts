import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck, check } from '../../test';
import { ValidSchemaName } from './index';
import { ThemeSchemaType } from '../..';

const DEFAULT_FILE_NAME = 'sections/file.liquid';

describe('Module: ValidSchemaName', () => {
  // We have a different check for that
  it('reports no offense when the schema is invalid', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": 10
        }
      {% endschema %}
    `;
    const offenses = await runLiquidCheck(ValidSchemaName, sourceCode, DEFAULT_FILE_NAME, {
      getSectionSchema: async () => ({
        ast: new Error('Invalid schema'),
        parsed: new Error('Invalid schema'),
        validSchema: new Error('Invalid schema'),
        name: 'file',
        type: ThemeSchemaType.Section,
        offset: 0,
        value: '',
        staticBlockDefs: [],
      }),
    });

    expect(offenses).toHaveLength(0);
  });

  it('reports offense with schema name over 25 characters long', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": "test-schema-name-that-is-too-long"
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(ValidSchemaName, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "Schema name 'test-schema-name-that-is-too-long' is too long (max 25 characters)",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).toBe('"test-schema-name-that-is-too-long"');
  });

  it('reports no offenses with schema name translation that exists and is not over 25 chars long', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json':
          '{ "default": { "my_translation_key": "My translation is good."}}',
        'code.liquid': `
          {% schema %}
            {
              "name": "t:default.my_translation_key"
            }
          {% endschema %}`,
      },
      [ValidSchemaName],
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense with schema name translation is missing', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json': '{ "another_translation_key": "Another translation"}',
        'sections/file.liquid': `
          {% schema %}
            {
              "name": "t:my_translation_key"
            }
          {% endschema %}`,
      },
      [ValidSchemaName],
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "'t:my_translation_key' does not have a matching entry in 'locales/en.default.schema.json'",
    );
  });

  it('reports an offense with schema name translation that exists and is over 25 chars long', async () => {
    const offenses = await check(
      {
        'locales/en.default.schema.json':
          '{ "my_translation_key": "My translation is tooooooooo long."}',
        'blocks/code.liquid': `
          {% schema %}
            {
              "name": "t:my_translation_key"
            }
          {% endschema %}`,
      },
      [ValidSchemaName],
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "Schema name 'My translation is tooooooooo long.' from 'locales/en.default.schema.json' is too long (max 25 characters)",
    );
  });
});
