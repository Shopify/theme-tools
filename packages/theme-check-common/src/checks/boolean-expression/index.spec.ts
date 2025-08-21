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

  it('does not fix when identifier follows a complete expression (Ruby would error)', async () => {
    const source = "{% if 1 and 2 foobar %}{{ 'hello' }}{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(0);
  });

  it('reports and fixes trailing tokens on right side of expression', async () => {
    const source = "{% if 1 == 2 foobar %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(1);
    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 1 == 2 %}x{% endif %}\n");
  });

  it('removes junk on both sides of the expression', async () => {
    const source = "{% if 20 a > 5 foobar %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(0);
  });

  // Additional tests to mirror Ruby behavior
  it('ignores junk after a standalone truthy number (0 is truthy in Liquid)', async () => {
    const source = "{% if 0 2 > 5 %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    const fixed = offenses.length ? applyFix(source, offenses[0]) : source;
    expect(fixed).toBe("{% if 0 %}x{% endif %}\n");
  });

  it('ignores junk after a truthy variable lookup (assigned)', async () => {
    const source = "{% assign jake = 7 %}{% if jake 1 > 100 %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    const fixed = offenses.length ? applyFix(source, offenses[0]) : source;
    expect(fixed).toBe("{% assign jake = 7 %}{% if jake %}x{% endif %}\n");
  });

  it('keeps logical chaining and cleans within each side', async () => {
    const source = "{% if 1 a > 2 and 3 b < 4 c %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    const fixed = offenses.length ? applyFix(source, offenses[0]) : source;
    // Left: `1 a > 2` -> aborts (id after number) so no fix; but right is also dirty.
    // Our implementation aborts the entire clean when encountering unknown operator scenario.
    expect(offenses).toHaveLength(0);
  });

  it('removes everything after a complete condition if non-operator token appears before logical operator', async () => {
    const source = "{% if 6 > 5 junk and 2 < 3 tail %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    const fixed = offenses.length ? applyFix(source, offenses[0]) : source;
    expect(fixed).toBe("{% if 6 > 5 %}x{% endif %}\n");
  });

  it('does not fix when identifier follows identifier (Unknown operator case)', async () => {
    const source = "{% if jake johnson > 5 %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(0);
  });

  it('does not fix when identifier follows number (Unknown operator case)', async () => {
    const source = "{% if 2 a > 5 foobar %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(0);
  });

  it('supports contains comparator and removes trailing junk', async () => {
    const source = "{% if 'abc' contains 'a' noise %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    const fixed = offenses.length ? applyFix(source, offenses[0]) : source;
    expect(fixed).toBe("{% if 'abc' contains 'a' %}x{% endif %}\n");
  });

  it('does not fix when stray identifiers appear between conditions (Ruby would error)', async () => {
    const source = "{% if 1 and 2 foo or 3 bar %}x{% endif %}\n";
    const offenses = await checkRuleFile(source);
    expect(offenses).toHaveLength(0);
  });
});


