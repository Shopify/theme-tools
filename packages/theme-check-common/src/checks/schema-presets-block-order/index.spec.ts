import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck, check } from '../../test';
import { SchemaPresetsBlockOrder } from './index';

const DEFAULT_FILE_NAME = 'sections/file.liquid';

describe('Module: SchemaPresetsBlockOrder', () => {
  it('reports no warning when the preset blocks are in the block_order', async () => {
    const sourceCode = `
        {% schema %}
        {
          "presets": [
            {
              "name": "Preset 1",
              "blocks": {
                "block-1": {
                  "type": "text"
                },
                "block-2": {
                  "type": "icon"
                }
              },
              "block_order": ["block-1", "block-2"]
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when not all preset blocks are in the block_order', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text"
              },
              "block-2": {
                "type": "icon"
              }
            },
            "block_order": ["block-1"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual("block 'block-2' is missing from the block_order");

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('["block-1"]');
  });

  it('reports no warning when the preset blocks has static blocks that are not in the block_order', async () => {
    const sourceCode = `
      {% schema %}
        {
          "presets": [
            {
              "name": "Preset 1",
              "blocks": {
                "block-1": {
                  "type": "text"
                },
                "block-2": {
                  "type": "icon",
                  "static": true
                }
              },
              "block_order": ["block-1"]
            }
          ]
        }
        {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when preset blocks has static blocks that are in the block_order', async () => {
    const sourceCode = `
      {% schema %}
      {
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text"
              },
              "block-2": {
                "type": "icon",
                "static": true
              }
            },
            "block_order": ["block-1", "block-2"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual("static block 'block-2' cannot be in the block_order");

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('["block-1", "block-2"]');
  });

  it('reports no warning when the nested preset blocks are in the block_order', async () => {
    const sourceCode = `
      {% schema %}
      {
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text",
                "blocks": {
                  "nested-1": {
                    "type": "nested"
                  },
                  "nested-2": {
                    "type": "nested"
                  }
                },
                "block_order": ["nested-1", "nested-2"]
              },
              "block-2": {
                "type": "icon"
              }
            },
            "block_order": ["block-1", "block-2"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the nested preset blocks are not in the block_order', async () => {
    const sourceCode = `
      {% schema %}
      {
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text",
                "blocks": {
                  "nested-1": {
                    "type": "nested"
                  },
                  "nested-2": {
                    "type": "nested"
                  }
                },
                "block_order": ["nested-1"]
              },
              "block-2": {
                "type": "icon"
              }
            },
            "block_order": ["block-1", "block-2"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual("block 'nested-2' is missing from the block_order");

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('["nested-1"]');
  });

  it('reports no warning when the nested preset blocks has static blocks that are not in the block_order', async () => {
    const sourceCode = `
      {% schema %}
      {
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text",
                "blocks": {
                  "nested-1": {
                    "type": "nested",
                    "static": true
                  },
                  "nested-2": {
                    "type": "nested"
                  }
                },
                "block_order": ["nested-2"]
              },
              "block-2": {
                "type": "icon"
              }
            },
            "block_order": ["block-1", "block-2"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it('reports a warning when the nested preset blocks has static blocks that are in the block_order', async () => {
    const sourceCode = `
      {% schema %}
      {
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text",
                "blocks": {
                  "nested-1": {
                    "type": "nested",
                    "static": true
                  },
                  "nested-2": {
                    "type": "nested"
                  }
                },
                "block_order": ["nested-1", "nested-2"]
              },
              "block-2": {
                "type": "icon"
              }
            },
            "block_order": ["block-1", "block-2"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual("static block 'nested-1' cannot be in the block_order");

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('["nested-1", "nested-2"]');
  });

  it('reports a warning when there should be a block_order but it is missing', async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text"
              }
            }
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual('block_order is missing');

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
  });

  it('reports no warning we have all static blocks and no block_order', async () => {
    const sourceCode = `
        {% schema %}
        {
          "presets": [
            {
              "name": "Preset 1",
              "blocks": {
                "block-1": {
                  "type": "text",
                  "static": true
                }
              }
            }
          ]
        }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(0);
  });

  it("reports a warning when a block in 'block_order' is not in 'blocks'", async () => {
    const sourceCode = `
      {% schema %}
      {
        "name": "Test section",
        "presets": [
          {
            "name": "Preset 1",
            "blocks": {
              "block-1": {
                "type": "text"
              }
            },
            "block_order": ["block-1", "block-2"]
          }
        ]
      }
      {% endschema %}`;

    const offenses = await runLiquidCheck(SchemaPresetsBlockOrder, sourceCode, DEFAULT_FILE_NAME);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual("block 'block-2' is missing from 'blocks'");

    const highlights = highlightedOffenses({ [DEFAULT_FILE_NAME]: sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('"block-2"');
  });
});
