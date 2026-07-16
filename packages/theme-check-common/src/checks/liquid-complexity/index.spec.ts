import { describe, expect, it } from 'vitest';
import { LiquidComplexity } from './index';
import { Severity } from '../../types';
import { check, runLiquidCheck } from '../../test';
import type { Offense } from '../../types';

const DEFAULT_PATH = 'snippets/test.liquid';

async function checkWithMaxComplexity(template: string, maxComplexity: number): Promise<Offense[]> {
  return checkSources([{ path: DEFAULT_PATH, source: template }], maxComplexity);
}

async function checkSources(
  sources: { path: string; source: string }[],
  maxComplexity: number,
): Promise<Offense[]> {
  const themeDesc = Object.fromEntries(sources.map(({ path, source }) => [path, source]));

  return check(
    themeDesc,
    [LiquidComplexity],
    {},
    { LiquidComplexity: { enabled: true, maxComplexity } },
  );
}

function repeatedIfs(count: number): string {
  return Array.from({ length: count }, (_, index) => `{% if enabled_${index} %}{% endif %}`).join(
    '\n',
  );
}

function expectComplexityMessage(
  offense: Offense,
  complexity: number,
  maxComplexity: number,
): void {
  expect(offense).toMatchObject({
    check: 'LiquidComplexity',
    severity: Severity.WARNING,
  });
  expect(offense.message).toContain(
    `Liquid complexity is ${complexity}, which exceeds the maximum of ${maxComplexity}.`,
  );
  expect(offense.message).toContain('pushed it over the limit');
  expect(offense.message).toContain('simplifying conditional logic');
  expect(offense.message).toContain(
    'moving self-contained decision logic into snippets with the render tag',
  );
}

describe('LiquidComplexity', () => {
  describe('wrapper tolerated maximum', () => {
    it('does not report when complexity equals 120', async () => {
      const offenses = await runLiquidCheck(LiquidComplexity, repeatedIfs(119), DEFAULT_PATH);

      expect(offenses).toEqual([]);
    });

    it('reports when complexity exceeds 120', async () => {
      const offenses = await runLiquidCheck(LiquidComplexity, repeatedIfs(120), DEFAULT_PATH);

      expect(offenses).toHaveLength(1);
      expectComplexityMessage(offenses[0], 121, 120);
    });
  });

  it('counts nested logical expressions', async () => {
    const template = `
      {% if available and visible %}
        Featured product
      {% elsif featured or highlighted %}
        Highlighted product
      {% endif %}
    `.trim();

    // 1 base + 1 if + 1 and + 1 elsif + 1 or = 5.
    await expect(checkWithMaxComplexity(template, 5)).resolves.toEqual([]);

    const offenses = await checkWithMaxComplexity(template, 4);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 5, 4);
  });

  it('counts logical expressions in unless conditions', async () => {
    const template = `
      {% unless hidden or archived %}
        Visible product
      {% endunless %}
    `.trim();

    // 1 base + 1 unless + 1 or = 3.
    await expect(checkWithMaxComplexity(template, 3)).resolves.toEqual([]);

    const offenses = await checkWithMaxComplexity(template, 2);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 3, 2);
  });

  it('does not count logical expressions in variable output or assign tags', async () => {
    const template = `
      {% assign visible = product.available and customer %}
      {{ product.available or customer }}
    `.trim();

    // 1 base. Non-branching assign and output boolean expressions do not count.
    await expect(checkWithMaxComplexity(template, 1)).resolves.toEqual([]);
  });

  it('counts decision points inside liquid tags', async () => {
    const template = `
      {% liquid
        if enabled
          echo 'Enabled'
        elsif archived
          echo 'Archived'
        endif
      %}
    `.trim();

    // 1 base + 1 if + 1 elsif = 3.
    await expect(checkWithMaxComplexity(template, 3)).resolves.toEqual([]);

    const offenses = await checkWithMaxComplexity(template, 2);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 3, 2);
  });

  it('counts each nested condition as another decision point', async () => {
    const template = `
      {% if product.available and product.published %}
        {% unless customer.banned or customer.guest %}
          {% if customer.tags contains 'vip' and settings.vip_enabled %}
            VIP offer
          {% elsif product.tags contains 'sale' or product.compare_at_price > product.price %}
            Sale offer
          {% endif %}
        {% endunless %}
      {% endif %}
    `.trim();

    // 1 base + 1 if + 1 and + 1 unless + 1 or + 1 nested if + 1 and + 1 elsif + 1 or = 9.
    await expect(checkWithMaxComplexity(template, 9)).resolves.toEqual([]);

    const offenses = await checkWithMaxComplexity(template, 8);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 9, 8);
  });

  it('resets complexity for each file', async () => {
    const source = '{% if enabled %}{% endif %}';

    const offenses = await checkSources(
      [
        { path: 'snippets/first.liquid', source },
        { path: 'snippets/second.liquid', source },
      ],
      2,
    );

    expect(offenses).toEqual([]);
  });

  it('tolerates parse errors', async () => {
    const template = '{% if enabled %}';

    await expect(checkWithMaxComplexity(template, 1)).resolves.toEqual([]);
  });

  it('reports plain files when maxComplexity is 0', async () => {
    const template = 'Hello';

    const offenses = await checkWithMaxComplexity(template, 0);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 1, 0);
    expect(offenses[0].start.index).toBe(0);
    expect(offenses[0].end.index).toBe(template.length);
  });

  it('counts case consistently with if and elsif', async () => {
    const template = `
      {% case status %}
      {% when 'active' %}
        Active
      {% when 'draft' %}
        Draft
      {% endcase %}
    `.trim();

    // 1 base + 1 case + 2 when branches = 4.
    await expect(checkWithMaxComplexity(template, 4)).resolves.toEqual([]);

    const offenses = await checkWithMaxComplexity(template, 3);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 4, 3);
  });

  it('reports the range of the decision point that first exceeds the maximum', async () => {
    const firstDecision = '{% if first %}';
    const secondDecision = '{% if second %}';
    const template = `${firstDecision}{% endif %}\n${secondDecision}{% endif %}`;
    const expectedStartIndex = template.indexOf(secondDecision);
    const expectedEndIndex = expectedStartIndex + secondDecision.length;

    const offenses = await checkWithMaxComplexity(template, 2);

    expect(offenses).toHaveLength(1);
    expectComplexityMessage(offenses[0], 3, 2);
    expect(offenses[0].start.index).toBe(expectedStartIndex);
    expect(offenses[0].end.index).toBe(expectedEndIndex);
  });
});
