import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { DeprecatedGlobalAppBlockType } from './index';

describe('Module: DeprecatedGlobalAppBlockType', () => {
  it('rejects invalid global app block type in section schemas', async () => {
    const sourceCode = `
      {% schema %}
        {
          "name": "Product section",
          "blocks": [{"type": "@global"}]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DeprecatedGlobalAppBlockType, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(
      'The global app block type `@global` is deprecated. Use `@app` instead.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['"blocks": [{"type": "@global"}]']);
  });

  it('rejects invalid global app block type in conditional statement', async () => {
    const sourceCode = `
      {% for block in section.blocks %}
        {% if block.type = "@global" %}
          {% render block %}
        {% elsif "@global" == block.type %}
        {% endif %}
      {% endfor %}
      {% schema %}
        {
          "name": "Product section",
          "blocks": [{"type": "@global"}]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DeprecatedGlobalAppBlockType, sourceCode);
    expect(offenses).toHaveLength(3);
    expect(offenses[0].message).toEqual(
      'The global app block type `@global` is deprecated. Use `@app` instead.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([
      '{% if block.type = "@global" %}',
      '{% elsif "@global" == block.type %}',
      '"blocks": [{"type": "@global"}]',
    ]);
  });

  it('rejects invalid global app block type in switch case statement', async () => {
    const sourceCode = `
      {% for block in section.blocks %}
        {% case block.type %}
          {% when "@global" %}
            {% render block %}
          {% else %}
        {% endcase %}
      {% endfor %}
      {% schema %}
        {
          "name": "Product section",
          "blocks": [{"type": "@global"}]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DeprecatedGlobalAppBlockType, sourceCode);
    expect(offenses).toHaveLength(2);
    expect(offenses[0].message).toEqual(
      'The global app block type `@global` is deprecated. Use `@app` instead.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['{% when "@global" %}', '"blocks": [{"type": "@global"}]']);
  });

  it('does not reject global string used outside liquid control flow statements', async () => {
    const sourceCode = `
      <p> This is "@global" </p>
      <script> var i = "@global" </script>
      {% schema %}
        {
          "name": "Product section"
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(DeprecatedGlobalAppBlockType, sourceCode);
    expect(offenses).toHaveLength(0);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(0);
  });

  it('accepts valid global app block type', async () => {
    const sourceCode = `
      {% for block in section.blocks %}
        {% if block.type = "@app" %}
          {% render block %}
        {% endif %}
      {% endfor %}
      {% schema %}
      {
        "name": "Product section",
        "blocks": [{"type": "@app"}]
      }
    {% endschema %}
  `;

    const offenses = await runLiquidCheck(DeprecatedGlobalAppBlockType, sourceCode);
    expect(offenses).toHaveLength(0);
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(0);
  });
});
