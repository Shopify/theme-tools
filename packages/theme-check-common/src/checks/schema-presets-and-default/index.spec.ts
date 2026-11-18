import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { SchemaPresetsAndDefault } from './index';

const DEFAULT_FILE_NAME = 'sections/file.liquid';

describe('Module: SchemaPresetsAndDefault', () => {
  it('reports an error when a section defines both presets and default', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "presets": [{ "name": "Preset 1" }],
        "default": { "settings": {} }
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsAndDefault, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      "Invalid schema: cannot define both 'default' and 'presets'",
    );

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toEqual(['{ "settings": {} }']);
  });

  it('reports an error when presets is an empty array', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "presets": [],
        "default": {}
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsAndDefault, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
  });

  it('reports no error when a section only defines presets', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "presets": [{ "name": "Preset 1" }]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsAndDefault, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it('reports no error when a section only defines default', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "default": { "settings": {} }
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsAndDefault, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it('does not run on theme blocks', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test block",
        "presets": [{ "name": "Preset 1" }]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(
      SchemaPresetsAndDefault,
      sourceCode,
      'blocks/file.liquid',
    );
    expect(offenses).toHaveLength(0);
  });
});
