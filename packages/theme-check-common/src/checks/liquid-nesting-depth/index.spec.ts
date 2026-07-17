import { describe, expect, it } from 'vitest';
import { LiquidNestingDepth, TOLERATED_LIQUID_NESTING_DEPTH } from './index';
import { Severity } from '../../types';
import { check, runLiquidCheck } from '../../test';
import type { Offense } from '../../types';

const DEFAULT_PATH = 'snippets/test.liquid';

async function checkWithMaxDepth(template: string, maxDepth: number): Promise<Offense[]> {
  return check(
    { [DEFAULT_PATH]: template },
    [LiquidNestingDepth],
    {},
    { LiquidNestingDepth: { enabled: true, maxDepth } },
  );
}

function nestedIfs(depth: number): string {
  return [
    ...Array.from({ length: depth }, (_, index) => `{% if condition_${index} %}`),
    'Nested content',
    ...Array.from({ length: depth }, () => '{% endif %}'),
  ].join('\n');
}

function expectNestingMessage(offense: Offense, depth: number, maxDepth: number): void {
  expect(offense).toMatchObject({
    check: 'LiquidNestingDepth',
    severity: Severity.WARNING,
  });
  expect(offense.message).toBe(
    `This Liquid block is nested ${depth} levels deep, which exceeds the maximum allowed depth of ${maxDepth}.`,
  );
}

describe('LiquidNestingDepth', () => {
  describe('wrapper tolerated maximum', () => {
    it('does not report when nesting equals the tolerated depth', async () => {
      const offenses = await runLiquidCheck(
        LiquidNestingDepth,
        nestedIfs(TOLERATED_LIQUID_NESTING_DEPTH),
        DEFAULT_PATH,
      );

      expect(offenses).toEqual([]);
    });

    it('reports when nesting exceeds the tolerated depth', async () => {
      const offenses = await runLiquidCheck(
        LiquidNestingDepth,
        nestedIfs(TOLERATED_LIQUID_NESTING_DEPTH + 1),
        DEFAULT_PATH,
      );

      expect(offenses).toHaveLength(1);
      expectNestingMessage(
        offenses[0],
        TOLERATED_LIQUID_NESTING_DEPTH + 1,
        TOLERATED_LIQUID_NESTING_DEPTH,
      );
    });
  });

  it('does not report a plain Liquid template', async () => {
    const template = '<div>{{ product.title }}</div>';

    await expect(checkWithMaxDepth(template, 1)).resolves.toEqual([]);
  });

  it('reports the first tag that exceeds a custom threshold', async () => {
    const threshold = 2;
    const nestedUnless = '{% unless hidden %}';
    const template = `
      {% if product.available %}
        {% for variant in product.variants %}
          ${nestedUnless}
            Available variant
          {% endunless %}
        {% endfor %}
      {% endif %}
    `.trim();
    const expectedStartIndex = template.indexOf(nestedUnless);
    const expectedEndIndex = expectedStartIndex + nestedUnless.length;

    const offenses = await checkWithMaxDepth(template, threshold);

    expect(offenses).toHaveLength(1);
    expectNestingMessage(offenses[0], 3, threshold);
    expect(offenses[0].start.index).toBe(expectedStartIndex);
    expect(offenses[0].end.index).toBe(expectedEndIndex);
  });

  it('reports each nested control-flow tag deeper than the threshold', async () => {
    const offenses = await checkWithMaxDepth(nestedIfs(5), 3);

    expect(offenses).toHaveLength(2);
    expectNestingMessage(offenses[0], 4, 3);
    expectNestingMessage(offenses[1], 5, 3);
  });

  it('does not count elsif and else branches as additional nesting', async () => {
    const template = `
      {% if product.available %}
        Available
      {% elsif product.tags contains 'coming-soon' %}
        Coming soon
      {% else %}
        Unavailable
      {% endif %}
    `.trim();

    await expect(checkWithMaxDepth(template, 1)).resolves.toEqual([]);
  });

  it('counts tablerow as a nesting tag', async () => {
    const template = `
      {% if section.blocks.size > 0 %}
        {% tablerow block in section.blocks %}
          {% unless block.settings.hidden %}
            {{ block.settings.title }}
          {% endunless %}
        {% endtablerow %}
      {% endif %}
    `.trim();

    const offenses = await checkWithMaxDepth(template, 2);

    expect(offenses).toHaveLength(1);
    expectNestingMessage(offenses[0], 3, 2);
  });

  it('counts nested case blocks consistently with if, unless, and for blocks', async () => {
    const template = `
      {% case section.settings.layout %}
        {% when 'grid' %}
          {% for product in collection.products %}
            {% if product.available %}
              {% unless product.tags contains 'hidden' %}
                {{ product.title }}
              {% endunless %}
            {% endif %}
          {% endfor %}
      {% endcase %}
    `.trim();

    const offenses = await checkWithMaxDepth(template, 3);

    expect(offenses).toHaveLength(1);
    expectNestingMessage(offenses[0], 4, 3);
  });

  it('does not count HTML nesting as Liquid nesting depth', async () => {
    const template = `
      <div>
        <div>
          <div>
            <div>
              {% if product.available %}
                Available
              {% endif %}
            </div>
          </div>
        </div>
      </div>
    `.trim();

    await expect(checkWithMaxDepth(template, 1)).resolves.toEqual([]);
  });
});
