import { expect, describe, it } from 'vitest';
import { ValidJSON } from './index';
import { highlightedOffenses, runJSONCheck } from '../../test';

describe('Module: ValidJSON', () => {
  it('should report an error for invalid JSON (0)', async () => {
    const invalidJson = `{
      "key1": "value1",
      "key2": "value2",,
    }`;

    const offenses = await runJSONCheck(ValidJSON, invalidJson, 'file.json', {
      jsonValidationSet: { schemas: async () => [] },
    });

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Property expected');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal(',');
  });

  it('should report an error for invalid JSON (1)', async () => {
    const invalidJson = `{
      "key1": "value1",
      "key2": "value2"
    `;

    const offenses = await runJSONCheck(ValidJSON, invalidJson, 'file.json', {
      jsonValidationSet: { schemas: async () => [] },
    });
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Expected comma or closing brace');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal('"');
  });

  it('should report an error for invalid JSON (2)', async () => {
    const invalidJson = `{
      'key1': "value1",
      "key2": "value2"
    }`;

    const offenses = await runJSONCheck(ValidJSON, invalidJson, 'file.json', {
      jsonValidationSet: { schemas: async () => [] },
    });
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Property keys must be doublequoted');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal("'key1'");
  });

  it('should report JSON schema validation errors', async () => {
    const invalidJson = `{
      "myString": 10
    }`;

    const basicJsonSchema = JSON.stringify({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        myString: {
          type: 'string',
        },
      },
    });

    const offenses = await runJSONCheck(ValidJSON, invalidJson, 'file.json', {
      jsonValidationSet: {
        schemas: async () => [
          {
            uri: 'https://shopify.dev/some-schema.json',
            schema: basicJsonSchema,
            fileMatch: ['file.json'],
          },
        ],
      },
    });

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Incorrect type. Expected "string".');

    const highlights = highlightedOffenses({ 'file.json': invalidJson }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal('10');
  });

  it('should not report any errors for valid JSON', async () => {
    const validJson = `{
      "key1": "value1",
      "key2": "value2"
    }`;

    const offenses = await runJSONCheck(ValidJSON, validJson);
    expect(offenses).to.be.empty;
  });
});
