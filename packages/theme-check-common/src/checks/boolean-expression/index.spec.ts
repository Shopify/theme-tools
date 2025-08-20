import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applyFix } from '../../test';
import { BooleanExpression } from './index';

async function checkRuleFile(source: string) {
  return runLiquidCheck(BooleanExpression as any, source, 'sections/example.liquid');
}

describe('Check: BooleanExpression', () => {
  it('does not report for a clean boolean expression', async () => {
    const offenses = await checkRuleFile("{% if 1 and 2 %}{{ 'hello' }}{% endif %}\n");
    expect(offenses).toHaveLength(0);
  });

  it('reports and fixes trailing tokens after expression', async () => {
    const source = "{% if 1 and 2 foobar %}{{ 'hello' }}{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      'Normalize boolean expression to "1 and 2"',
    );
    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 1 and 2 %}{{ 'hello' }}{% endif %}\n");
  });

  it('reports and fixes trailing tokens after a comparison expression', async () => {
    const source = "{% if 1 == 2 foobar %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      'Normalize boolean expression to "1 == 2"',
    );
    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 1 == 2 %}x{% endif %}\n");
  });

  it('removes junk on both sides of the expression', async () => {
    const source = "{% if 20 a > 5 foobar %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      'Normalize boolean expression to "20 > 5"',
    );
    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 20 > 5 %}x{% endif %}\n");
  });
});


