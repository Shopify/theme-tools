import { expect, describe, it } from 'vitest';
import { runLiquidCheck, applyFix } from '../../../test';
import { LiquidHTMLSyntaxError } from '..';

describe('Module: InvalidConditionalBooleanExpression', () => {
  it('should not report an offense for valid boolean expressions', async () => {
    const testCases = [
      '{% if 1 > 2 %}hello{% endif %}',
      '{% if variable == 5 %}hello{% endif %}',
      "{% if 'abc' contains 'a' %}hello{% endif %}",
      "{% if product.title != '' %}hello{% endif %}",
      '{% if 1 and 2 %}hello{% endif %}',
      '{% if true or false %}hello{% endif %}',
      '{% if 10 > 5 and user.active %}hello{% endif %}',
      '{% if price >= 100 or discount %}hello{% endif %}',
      "{% if user.name contains 'admin' or user.role == 'owner' %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for valid single values', async () => {
    const testCases = [
      '{% if variable %}hello{% endif %}',
      '{% if user.active %}hello{% endif %}',
      '{% if true %}hello{% endif %}',
      '{% if false %}hello{% endif %}',
      '{% if 1 %}hello{% endif %}',
      '{% if 0 %}hello{% endif %}',
      "{% if 'string' %}hello{% endif %}",
      '{% if contains %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report an offense when parser stops at numbers', async () => {
    const source = '{% if 7 1 > 100 %}hello{% endif %}';
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "Syntax is not supported: Expression stops at truthy value '7', and will ignore: '1 > 100'",
    );

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).to.equal('{% if 7 %}hello{% endif %}');
  });

  it('should report an offense when parser stops at strings', async () => {
    const source = "{% if 'hello' 1 > 100 %}world{% endif %}";
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "Syntax is not supported: Expression stops at truthy value ''hello'', and will ignore: '1 > 100'",
    );

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).to.equal("{% if 'hello' %}world{% endif %}");
  });

  it('should report an offense when parser stops at liquid literals', async () => {
    const testCases = [
      { source: '{% if true 1 > 0 %}hello{% endif %}', value: 'true' },
      { source: '{% if false 1 > 0 %}hello{% endif %}', value: 'false' },
      { source: '{% if nil 6 > 5 %}hello{% endif %}', value: 'nil' },
      { source: '{% if empty 123 456 %}hello{% endif %}', value: 'empty' },
      { source: '{% if blank 789 %}hello{% endif %}', value: 'blank' },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase.source);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain(
        `Expression stops at truthy value '${testCase.value}'`,
      );

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).to.equal(`{% if ${testCase.value} %}hello{% endif %}`);
    }
  });

  it('should report offenses in different liquid tag types', async () => {
    const testCases = [
      '{% if 7 1 > 100 %}hello{% endif %}',
      "{% unless 'test' 42 > 0 %}hello{% endunless %}",
      '{% if false %}no{% elsif 7 1 > 100 %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain('Expression stops at truthy value');
    }
  });

  it('should report an offense for malformed expression starting with invalid token', async () => {
    const source = '{% if > 2 %}hello{% endif %}';
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "Syntax is not supported: Conditional cannot start with '>'. Use a variable or value instead",
    );

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).to.equal('{% if false %}hello{% endif %}');
  });

  it('should report an offense for bare operators with no operands', async () => {
    const testCases = [
      { source: '{% if > %}hello{% endif %}', token: '>' },
      { source: '{% if == %}hello{% endif %}', token: '==' },
      { source: '{% if < %}hello{% endif %}', token: '<' },
      { source: '{% if != %}hello{% endif %}', token: '!=' },
      { source: '{% if >= %}hello{% endif %}', token: '>=' },
      { source: '{% if <= %}hello{% endif %}', token: '<=' },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase.source);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain(`Conditional cannot start with '${testCase.token}'`);

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).to.equal('{% if false %}hello{% endif %}');
    }
  });

  it('should report an offense for other invalid starting characters', async () => {
    const testCases = [
      { source: '{% if @ %}hello{% endif %}', token: '@' },
      { source: '{% if # %}hello{% endif %}', token: '#' },
      { source: '{% if $ %}hello{% endif %}', token: '$' },
      { source: '{% if & %}hello{% endif %}', token: '&' },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase.source);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain(`Conditional cannot start with '${testCase.token}'`);

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).to.equal('{% if false %}hello{% endif %}');
    }
  });

  it('should report an offense for malformed expressions in complex expressions', async () => {
    const testCases = [
      '{% if > 5 and true %}hello{% endif %}',
      '{% if == 2 or false %}hello{% endif %}',
      '{% if < 10 and variable %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain('Conditional cannot start with');

      const fixed = applyFix(testCase, offenses[0]);
      expect(fixed).to.equal('{% if false %}hello{% endif %}');
    }
  });

  it('should report an offense for trailing tokens after comparison', async () => {
    const source = '{% if 1 == 2 foobar %}hello{% endif %}';
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "Syntax is not supported: Conditional is invalid. Anything after '1 == 2' will be ignored",
    );

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).to.equal('{% if 1 == 2 %}hello{% endif %}');
  });

  it('should report an offense for malformed comparisons like missing quotes', async () => {
    const testCases = [
      {
        source: "{% if 'wat' == 'squat > 2 %}hello{% endif %}",
        description: 'missing closing quote creates trailing comparison',
      },
      {
        source: "{% if 'wat' == 'squat' > 2 %}hello{% endif %}",
        description: 'extra comparison after valid comparison',
      },
      {
        source: "{% if price == 'test' != 5 %}hello{% endif %}",
        description: 'chained comparisons without logical operators',
      },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase.source);
      expect(offenses, `Failed for: ${testCase.description}`).to.have.length(1);
      expect(offenses[0].message).to.contain('Anything after');
    }
  });

  it('should report an offense for multiple trailing tokens', async () => {
    const source = '{% if 10 > 4 baz qux %}hello{% endif %}';
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.contain('Anything after');

    const fixed = applyFix(source, offenses[0]);
    expect(fixed).to.equal('{% if 10 > 4 %}hello{% endif %}');
  });

  it('should report an offense for trailing junk with different operators', async () => {
    const testCases = [
      "{% if 'abc' contains 'a' noise %}hello{% endif %}",
      '{% if price <= 50 extra %}hello{% endif %}',
      '{% if count != 0 junk %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain('Anything after');
    }
  });

  it('should not report an offense for valid logical continuations', async () => {
    const testCases = [
      '{% if 1 > 0 and 2 < 3 %}hello{% endif %}',
      '{% if x == 5 or y != 10 %}hello{% endif %}',
      '{% if price >= 100 and discount %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for truthy values followed by logical operators', async () => {
    const testCases = [
      '{% if true and variable %}hello{% endif %}',
      '{% if false or variable %}hello{% endif %}',
      '{% if 1 and user.active %}hello{% endif %}',
      '{% if 0 or fallback %}hello{% endif %}',
      "{% if 'string' and condition %}hello{% endif %}",
      "{% if 'value' or default %}hello{% endif %}",
      '{% if 42 and check %}hello{% endif %}',
      '{% if 3.14 or backup %}hello{% endif %}',
      '{% if nil and something %}hello{% endif %}',
      '{% if empty or alternative %}hello{% endif %}',
      '{% if blank and other %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for complex expressions with truthy values and logical operators', async () => {
    const testCases = [
      '{% if true and variable > 5 %}hello{% endif %}',
      "{% if 'test' or user.name == 'admin' %}hello{% endif %}",
      '{% if 42 and price <= 100 %}hello{% endif %}',
      '{% if false or count != 0 %}hello{% endif %}',
      "{% if empty and product.title contains 'sale' %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for unknown operators errors after values (Liquid catches these)', async () => {
    const testCases = [
      '{% if my_var word > 5 %}hello{% endif %}',
      '{% if jake johnson > 5 %}hello{% endif %}',
      "{% if 'test' invalid > thing %}hello{% endif %}",
      "{% if user.name custom 'admin' %}hello{% endif %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for unknown operators after variables', async () => {
    const testCases = [
      '{% if variable unknown > 5 %}hello{% endif %}',
      "{% if user.role badop 'admin' %}hello{% endif %}",
      '{% if price fake 100 %}hello{% endif %}',
      '{% if "str" blue == something %}hello{% endif %}',
      '{% if red blue > something %}hello{% endif %}',
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for unknown operators in complex expressions', async () => {
    const testCases = [
      "{% if user.active and name fake 'test' %}hello{% endif %}",
      "{% unless 'test' some > thing %}hello{% endunless %}",
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report an offense for pipe filter expressions', async () => {
    const testCases = ['{% if wat | something == something %}hello{% endif %}'];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report an offense for misspelled logical operators', async () => {
    const testCases = [
      {
        source: '{% if "wat" == "squat" adn "wat" == "squat" %}hello{% endif %}',
        misspelled: 'adn',
        expectedFix: '"wat" == "squat"',
      },
      {
        source: '{% if variable > 5 andd other < 10 %}hello{% endif %}',
        misspelled: 'andd',
        expectedFix: 'variable > 5',
      },
    ];

    for (const testCase of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase.source);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain('Anything after');

      const fixed = applyFix(testCase.source, offenses[0]);
      expect(fixed).to.contain(testCase.expectedFix);
    }
  });

  it('should report special message for JavaScript-style operators after literal values', async () => {
    const testCases = [
      '{% if true && false %}hello{% endif %}',
      '{% if false || true %}hello{% endif %}',
      '{% if "hello" && world %}hello{% endif %}',
      '{% if 42 || something %}hello{% endif %}',
    ];

    for (const source of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain(
        "Use 'and'/'or' instead of '&&'/'||' for multiple conditions",
      );
    }
  });

  it('should NOT report an offense for valid logical operators', async () => {
    const validCases = [
      '{% if price > 100 and discount < 50 %}hello{% endif %}',
      '{% if user.active or user.premium %}hello{% endif %}',
      '{% if x == 1 and y == 2 or z == 3 %}hello{% endif %}',
    ];

    for (const testCase of validCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, testCase);
      expect(offenses).to.have.length(0);
    }
  });
});
