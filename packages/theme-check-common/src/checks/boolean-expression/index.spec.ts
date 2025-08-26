import { expect, describe, it } from 'vitest';
import { BooleanExpression } from './index';
import { runLiquidCheck, applyFix } from '../../test';

describe('Module: BooleanExpression', () => {
    it('should not report an offense for valid boolean expressions', async () => {
    const testCases = [
      "{% if 1 > 2 %}hello{% endif %}",
      "{% if variable == 5 %}hello{% endif %}",
      "{% if 'abc' contains 'a' %}hello{% endif %}",
      "{% if product.title != '' %}hello{% endif %}",
      "{% if 1 and 2 %}hello{% endif %}",
      "{% if true or false %}hello{% endif %}",
      "{% if 10 > 5 and user.active %}hello{% endif %}",
      "{% if price >= 100 or discount %}hello{% endif %}",
      "{% if (1 > 0) and (2 < 3) %}hello{% endif %}",
      "{% if user.name contains 'admin' or user.role == 'owner' %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(0);
    }
  });

  it('should not report an offense for valid single values', async () => {
    const testCases = [
      "{% if variable %}hello{% endif %}",
      "{% if user.active %}hello{% endif %}",
      "{% if true %}hello{% endif %}",
      "{% if false %}hello{% endif %}",
      "{% if 1 %}hello{% endif %}",
      "{% if 0 %}hello{% endif %}",
      "{% if 'string' %}hello{% endif %}",
      "{% if contains %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(0);
    }
  });

  it('should report an offense when parser stops at numbers', async () => {
    const source = "{% if 7 1 > 100 %}hello{% endif %}";
    const offenses = await runLiquidCheck(BooleanExpression, source);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Liquid lax parsing issue: Expression stops at truthy value '7', ignoring: '1 > 100'");

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 7 %}hello{% endif %}");
  });

  it('should report an offense when parser stops at strings', async () => {
    const source = "{% if 'hello' 1 > 100 %}world{% endif %}";
    const offenses = await runLiquidCheck(BooleanExpression, source);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Liquid lax parsing issue: Expression stops at truthy value ''hello'', ignoring: '1 > 100'");

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 'hello' %}world{% endif %}");
  });

  it('should report an offense when parser stops at liquid literals', async () => {
    const testCases = [
      { source: "{% if true 1 > 0 %}hello{% endif %}", value: "true" },
      { source: "{% if false 1 > 0 %}hello{% endif %}", value: "false" },
      { source: "{% if nil 6 > 5 %}hello{% endif %}", value: "nil" },
      { source: "{% if empty 123 456 %}hello{% endif %}", value: "empty" },
      { source: "{% if blank 789 %}hello{% endif %}", value: "blank" },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase.source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain(`Expression stops at truthy value '${testCase.value}'`);

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).toBe(`{% if ${testCase.value} %}hello{% endif %}`);
    }
  });

  it('should report offenses in different liquid tag types', async () => {
    const testCases = [
      "{% if 7 1 > 100 %}hello{% endif %}",
      "{% unless 'test' 42 > 0 %}hello{% endunless %}",
      "{% if false %}no{% elsif 7 1 > 100 %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Expression stops at truthy value");
    }
  });

  it('should report an offense for malformed expression starting with invalid token', async () => {
    const source = "{% if > 2 %}hello{% endif %}";
    const offenses = await runLiquidCheck(BooleanExpression, source);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Liquid lax parsing issue: Malformed expression starting with invalid token '>'");

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if false %}hello{% endif %}");
  });

  it('should report an offense for bare operators with no operands', async () => {
    const testCases = [
      { source: "{% if > %}hello{% endif %}", token: ">" },
      { source: "{% if == %}hello{% endif %}", token: "==" },
      { source: "{% if < %}hello{% endif %}", token: "<" },
      { source: "{% if != %}hello{% endif %}", token: "!=" },
      { source: "{% if >= %}hello{% endif %}", token: ">=" },
      { source: "{% if <= %}hello{% endif %}", token: "<=" },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase.source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain(`Malformed expression starting with invalid token '${testCase.token}'`);

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).toBe("{% if false %}hello{% endif %}");
    }
  });

  it('should report an offense for other invalid starting characters', async () => {
    const testCases = [
      { source: "{% if @ %}hello{% endif %}", token: "@" },
      { source: "{% if # %}hello{% endif %}", token: "#" },
      { source: "{% if $ %}hello{% endif %}", token: "$" },
      { source: "{% if & %}hello{% endif %}", token: "&" },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase.source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain(`Malformed expression starting with invalid token '${testCase.token}'`);

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).toBe("{% if false %}hello{% endif %}");
    }
  });

  it('should report an offense for malformed expressions in complex expressions', async () => {
    const testCases = [
      "{% if > 5 and true %}hello{% endif %}",
      "{% if == 2 or false %}hello{% endif %}",
      "{% if < 10 and variable %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Malformed expression starting with invalid token");

      const fixed = applyFix(testCase, offenses[0]);
      expect(fixed).toBe("{% if false %}hello{% endif %}");
    }
  });

  it('should report an offense for trailing tokens after comparison', async () => {
    const source = "{% if 1 == 2 foobar %}hello{% endif %}";
    const offenses = await runLiquidCheck(BooleanExpression, source);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Liquid lax parsing issue: Trailing tokens ignored after comparison: 'foobar'");

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 1 == 2 %}hello{% endif %}");
  });

  it('should report an offense for multiple trailing tokens', async () => {
    const source = "{% if 10 > 4 baz qux %}hello{% endif %}";
    const offenses = await runLiquidCheck(BooleanExpression, source);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain("Trailing tokens ignored");

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).toBe("{% if 10 > 4 %}hello{% endif %}");
  });

  it('should report an offense for trailing junk with different operators', async () => {
    const testCases = [
      "{% if 'abc' contains 'a' noise %}hello{% endif %}",
      "{% if price <= 50 extra %}hello{% endif %}",
      "{% if count != 0 junk %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Trailing tokens ignored");
    }
  });

  it('should not report an offense for valid logical continuations', async () => {
    const testCases = [
      "{% if 1 > 0 and 2 < 3 %}hello{% endif %}",
      "{% if x == 5 or y != 10 %}hello{% endif %}",
      "{% if price >= 100 and discount %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(0);
    }
  });

  it('should not report an offense for unknown operators errors after values (Liquid catches these)', async () => {
    const testCases = [
      "{% if my_var word > 5 %}hello{% endif %}",
      "{% if jake johnson > 5 %}hello{% endif %}",
      "{% if 'test' invalid > thing %}hello{% endif %}",
      "{% if user.name custom 'admin' %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(0);
    }
  });

  it('should not report an offense for unknown operators after variables', async () => {
    const testCases = [
      "{% if variable unknown > 5 %}hello{% endif %}",
      "{% if user.role badop 'admin' %}hello{% endif %}",
      "{% if price fake 100 %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(0);
    }
  });

  it('should not report an offense for unknown operators in complex expressions', async () => {
    const testCases = [
      "{% if user.active and name fake 'test' %}hello{% endif %}",
      "{% unless 'test' some > thing %}hello{% endunless %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(BooleanExpression, testCase);
      expect(offenses).toHaveLength(0);
    }
  });
});
