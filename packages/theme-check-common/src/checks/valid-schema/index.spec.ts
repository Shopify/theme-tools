import lodashSet from 'lodash/set';
import { describe, expect, it } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { ValidSchema } from './index';
import { ValidateFunction } from '../../types/theme-liquid-docs';
import { Dependencies } from '../../types';

const DEFAULT_FILE_NAME = 'sections/file.liquid';
const VALID_SECTION_SCHEMA = {
  name: 't:sections.main-addresses.name',
  settings: [
    {
      type: 'header',
      content: 't:sections.all.padding.section_padding_heading',
    },
    {
      type: 'range',
      id: 'padding_top',
      min: 0,
      max: 100,
      step: 4,
      unit: 'px',
      label: 't:sections.all.padding.padding_top',
      default: 36,
    },
    {
      type: 'range',
      id: 'padding_bottom',
      min: 0,
      max: 100,
      step: 4,
      unit: 'px',
      label: 't:sections.all.padding.padding_bottom',
      default: 36,
    },
  ],
};

// Deep copy valid data
const INVALID_SECTION_SCHEMA = JSON.parse(JSON.stringify(VALID_SECTION_SCHEMA));

lodashSet(INVALID_SECTION_SCHEMA, 'settings.2.label', 420);
lodashSet(INVALID_SECTION_SCHEMA, 'disabled_on', true);
lodashSet(INVALID_SECTION_SCHEMA, 'max_blocks', 51);

const buildMockDeps = (errors?: any[]): Partial<Dependencies> => ({
  jsonValidationSet: {
    async validateSectionSchema() {
      const mockValidator: ValidateFunction = () => {
        mockValidator.errors = errors ?? [
          { instancePath: '/settings/2/label', message: 'must be string' },
          { instancePath: '/max_blocks', message: 'must be <= 50' },
          { instancePath: '/disabled_on', message: 'must be object' },
        ];
        return false;
      };

      return mockValidator;
    },

    async sectionSchema() {
      return JSON.stringify(VALID_SECTION_SCHEMA);
    },

    async translationSchema() {
      return '{}';
    },
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
      message: expect.stringContaining('Invalid syntax in schema JSON: '),
      absolutePath: `/${DEFAULT_FILE_NAME}`,
    });
  });

  it('should report a syntax error when the schema json has a trailing comma', async () => {
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

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).to.have.length(1);
    expect(highlights[0]).to.equal(' }');

    expect(offenses).to.have.length(1);
    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: expect.stringContaining('Invalid syntax in schema JSON: '),
      absolutePath: `/${DEFAULT_FILE_NAME}`,
    });
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
      message: 'label must be string',
      absolutePath: `/${DEFAULT_FILE_NAME}`,
      start: {
        index: 530,
        line: 26,
        character: 6,
      },
      end: {
        index: 542,
        line: 26,
        character: 18,
      },
    });
    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: 'max_blocks must be <= 50',
      absolutePath: `/${DEFAULT_FILE_NAME}`,
      start: {
        index: 600,
        line: 31,
        character: 2,
      },
      end: {
        index: 616,
        line: 31,
        character: 18,
      },
    });

    expect(offenses).to.containOffense({
      check: ValidSchema.meta.code,
      message: 'disabled_on must be object',
      absolutePath: `/${DEFAULT_FILE_NAME}`,
      start: {
        index: 577,
        line: 30,
        character: 2,
      },
      end: {
        index: 596,
        line: 30,
        character: 21,
      },
    });
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
      buildMockDeps([]),
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
