import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { ValidSchemaName } from './index';

const DEFAULT_FILE_NAME = 'sections/file.liquid';

describe('Module: ValidSchemaName', () => {
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
    expect(offenses[0].message).toEqual('Schema name is too long (max 25 characters)');

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).to.have.length(1);
  });
});
