import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applyFix } from '../../test';
import { BooleanExpression } from './index';

async function checkRuleFile(source: string) {
  return runLiquidCheck(BooleanExpression as any, source, 'sections/example.liquid');
}

describe('Check: BooleanExpression', () => {
  describe('Valid expressions (should not report)', () => {
    it('does not report for clean boolean expressions', async () => {
      const testCases = [
        "{% if 1 and 2 %}hello{% endif %}",
        "{% if variable > 5 %}hello{% endif %}",
        "{% if 'abc' contains 'a' %}hello{% endif %}",
        "{% if true or false %}hello{% endif %}",
        "{% if 10 > 5 and user.active %}hello{% endif %}",
      ];

      for (const testCase of testCases) {
        const offenses = await checkRuleFile(testCase);
        expect(offenses).toHaveLength(0);
      }
    });
  });

  describe('Left-side evaluation (stops at first truthy)', () => {
    it('detects when parser stops at truthy number', async () => {
      const source = "{% if 7 1 > 100 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("stops at truthy value '7'");
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if 7 %}hello{% endif %}");
    });

    it('detects when parser stops at truthy string', async () => {
      const source = "{% if 'hello' 1 > 100 %}world{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("stops at truthy value ''hello''");
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if 'hello' %}world{% endif %}");
    });

    it('detects when parser stops at zero (truthy in Liquid)', async () => {
      const source = "{% if 0 2 > 5 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if 0 %}hello{% endif %}");
    });

    it('detects when parser stops at empty string (truthy in Liquid)', async () => {
      const source = "{% if '' some > thing %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if '' %}hello{% endif %}");
    });
  });

  describe('Unknown operator errors', () => {
    it('detects unknown operator after variable', async () => {
      const source = "{% if my_var word > 5 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Unknown operator 'word' after variable 'my_var'");
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if my_var %}hello{% endif %}");
    });

    it('detects multiple identifiers in sequence', async () => {
      const source = "{% if jake johnson > 5 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Unknown operator 'johnson' after variable 'jake'");
    });
  });

  describe('Trailing junk after complete expressions', () => {
    it('detects trailing tokens after comparison', async () => {
      const source = "{% if 1 == 2 foobar %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Trailing tokens ignored after comparison: 'foobar'");
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if 1 == 2 %}hello{% endif %}");
    });

    it('detects multiple trailing tokens', async () => {
      const source = "{% if 10 > 4 baz qux %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Trailing tokens ignored");
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if 10 > 4 %}hello{% endif %}");
    });

    it('detects trailing junk after contains', async () => {
      const source = "{% if 'abc' contains 'a' noise more %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      const fixed = applyFix(source, offenses[0]);
      expect(fixed).toBe("{% if 'abc' contains 'a' %}hello{% endif %}");
    });
  });

  describe('Complex expressions with logical operators', () => {
    it('handles valid logical chaining', async () => {
      const source = "{% if 1 > 0 and 2 < 3 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(0);
    });

    it('detects issues in complex expressions', async () => {
      const source = "{% if 5 > 6 foobar and 2 < 3 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Trailing tokens ignored");
    });
  });

  describe('Edge cases matching Ruby behavior', () => {
    it('handles false literal correctly', async () => {
      const source = "{% if false 1 > 0 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      // false is falsy, so this should not trigger left-side evaluation
      expect(offenses).toHaveLength(0);
    });

    it('handles nil literal correctly', async () => {
      const source = "{% if nil 6 > 5 %}hello{% endif %}";
      const offenses = await checkRuleFile(source);
      // nil is falsy, so this should not trigger left-side evaluation
      expect(offenses).toHaveLength(0);
    });

    //         it('works with elsif tag', async () => {
    //   const source = "{% if false %}no{% elsif 7 1 > 100 %}hello{% endif %}";
    //   const offenses = await checkRuleFile(source);
    //   expect(offenses).toHaveLength(1);
    //   if (offenses.length > 0) {
    //     expect(offenses[0].message).toContain("Expression stops at truthy value '7'");
    //   }
    // });

    it('works with unless tag', async () => {
      const source = "{% unless 'test' some > thing %}hello{% endunless %}";
      const offenses = await checkRuleFile(source);
      expect(offenses).toHaveLength(1);
      if (offenses.length > 0) {
        expect(offenses[0].message).toContain("Expression stops at truthy value ''test''");
      }
    });
  });
});
