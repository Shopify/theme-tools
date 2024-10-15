import lodashSet from 'lodash/set';
import { describe, expect, it } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { ValidSchema } from './index';
import { Dependencies } from '../../types';

const DEFAULT_FILE_NAME = 'sections/file.liquid';
const VALID_SECTION_SCHEMA = {
  shouldBeString: 't:sections.main-addresses.name',
  shouldBeNumber: 10,
  shouldBeIntegerLessThan51: 50,
};

// Deep copy valid data
const INVALID_SECTION_SCHEMA = JSON.parse(JSON.stringify(VALID_SECTION_SCHEMA));

lodashSet(INVALID_SECTION_SCHEMA, 'shouldBeString', 420);
lodashSet(INVALID_SECTION_SCHEMA, 'shouldBeNumber', true);
lodashSet(INVALID_SECTION_SCHEMA, 'shouldBeIntegerLessThan51', 51);

const MockSectionSchemaJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    shouldBeString: {
      type: 'string',
    },
    shouldBeNumber: {
      type: 'number',
    },
    shouldBeIntegerLessThan51: {
      type: 'integer',
      description: 'The number of times a section can be added to a template or section group.',
      maximum: 50,
    },
  },
};

const buildMockDeps = (): Partial<Dependencies> => ({
  jsonValidationSet: {
    schemas: async () => [
      {
        uri: 'https://shopify.dev/some-schema.json',
        schema: JSON.stringify(MockSectionSchemaJsonSchema),
        fileMatch: ['**/sections/*.liquid'],
      },
    ],
  },
});

describe('ValidSchema', () => {
  it('should report a syntax error when the schema json is malformed', async () => {
    const sourceCode = `
    {% schema %}
    {

    {% endschema %}
    `;

    const offenses = await runLiquidCheck(
      ValidSchema,
      sourceCode,
      DEFAULT_FILE_NAME,
      buildMockDeps(),
    );
    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0].trim()).to.equal('{');

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: expect.stringContaining('Expected comma or closing brace'),
      uri: `file:///${DEFAULT_FILE_NAME}`,
    });
  });

  it('should not report a syntax error when the schema json has a trailing comma', async () => {
    const sourceCode = `
    {% schema %}
    {
      "comma": "not trailing",
    }
    {% endschema %}
    `;

    const offenses = await runLiquidCheck(
      ValidSchema,
      sourceCode,
      DEFAULT_FILE_NAME,
      buildMockDeps(),
    );

    expect(offenses).to.have.length(0);
  });

  it('should complain appropriately when a section schema contains errors', async () => {
    const sourceCode = `
    {% schema %}
    ${JSON.stringify(INVALID_SECTION_SCHEMA, null, 2)}
    {% endschema %}
    `;

    const offenses = await runLiquidCheck(
      ValidSchema,
      sourceCode,
      DEFAULT_FILE_NAME,
      buildMockDeps(),
    );

    expect(offenses).to.have.length(3);
    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: 'Incorrect type. Expected "string".',
      uri: `file:///${DEFAULT_FILE_NAME}`,
    });
    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: 'Incorrect type. Expected "number".',
      uri: `file:///${DEFAULT_FILE_NAME}`,
    });
    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: 'Value is above the maximum of 50.',
      uri: `file:///${DEFAULT_FILE_NAME}`,
    });
  });

  it('should not complain when there is no JSON schema associated with the file', async () => {
    const sourceCode = `
    {% schema %}
    ${JSON.stringify(INVALID_SECTION_SCHEMA, null, 2)}
    {% endschema %}
    `;

    const offenses = await runLiquidCheck(
      ValidSchema,
      sourceCode,
      '/blocks/file.liquid',
      buildMockDeps(),
    );

    expect(offenses).to.have.length(0);
  });

  it('should not complain when a section schema is valid', async () => {
    const sourceCode = `
    {% schema %}
    ${JSON.stringify(VALID_SECTION_SCHEMA, null, 2)}
    {% endschema %}
    `;

    const offenses = await runLiquidCheck(
      ValidSchema,
      sourceCode,
      DEFAULT_FILE_NAME,
      buildMockDeps(),
    );

    expect(offenses).to.have.length(0);
  });

  it('should not complain when a schema is invalid outside of sections', async () => {
    const sourceCode = `
    {% schema %}
    ${JSON.stringify(INVALID_SECTION_SCHEMA, null, 2)}
    {% endschema %}
    `;

    const offenses = await runLiquidCheck(ValidSchema, sourceCode);

    expect(offenses).to.have.length(0);
  });
});
