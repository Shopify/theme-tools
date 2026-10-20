import { expect, describe, it } from 'vitest';
import { runLiquidCheck } from '../../test';
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
});
