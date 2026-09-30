import { describe, expect, it } from 'vitest';
import { recommended } from '../index';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { Severity } from '../../types';
import { BlockContentUsage } from './index';

const MESSAGE = "Use the implicit 'content' parameter directly instead of 'block.content'.";

describe('BlockContentUsage', () => {
  it('is a recommended error', () => {
    expect(recommended).toContain(BlockContentUsage);
    expect(BlockContentUsage.meta.severity).toBe(Severity.ERROR);
  });

  it.each([
    ['{{ block.content }}', 'block.content'],
    ["{{ block['content'] | upcase }}", "block['content']"],
    ['{{ block.content.size }}', 'block.content.size'],
    ['{% if block.content != blank %}{{ content }}{% endif %}', 'block.content'],
    ["{% render 'card', body: block.content %}", 'block.content'],
    ['{% liquid\n  echo block.content\n%}', 'block.content'],
  ])('reports the block.content lookup in %j', async (source, highlight) => {
    const offenses = await runLiquidCheck(BlockContentUsage, source, 'blocks/card.liquid');

    expect(offenses).toMatchObject([{ message: MESSAGE, severity: Severity.ERROR }]);
    expect(highlightedOffenses({ 'blocks/card.liquid': source }, offenses)).toEqual([highlight]);
  });

  it('accepts bare content and other block properties', async () => {
    const source = [
      '{{ content }}',
      '{{ block.id }}',
      '{{ block.settings.content }}',
      '{{ block.shopify_attributes }}',
      '{{ product.content }}',
    ].join('\n');

    const offenses = await runLiquidCheck(BlockContentUsage, source, 'blocks/card.liquid');

    expect(offenses).toEqual([]);
  });

  it.each([
    'sections/main.liquid',
    'snippets/card.liquid',
    'templates/index.liquid',
    'layout/theme.liquid',
  ])('does not report the ordinary block object in %s', async (fileName) => {
    const source = '{% for block in section.blocks %}{{ block.content }}{% endfor %}';

    const offenses = await runLiquidCheck(BlockContentUsage, source, fileName);

    expect(offenses).toEqual([]);
  });

  it('does not report block.content inside a tag that does not render Liquid', async () => {
    const source = '{% javascript %}console.log("{{ block.content }}");{% endjavascript %}';

    const offenses = await runLiquidCheck(BlockContentUsage, source, 'blocks/card.liquid');

    expect(offenses).toEqual([]);
  });
});
