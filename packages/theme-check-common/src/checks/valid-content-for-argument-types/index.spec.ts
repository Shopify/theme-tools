import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applySuggestions } from '../../test';
import { ValidContentForArgumentTypes } from '.';
import { BasicParamTypes } from '../../liquid-doc/utils';

describe('Module: ValidContentForParamTypes', () => {
  describe('type validation', () => {
    const typeTests = [
      {
        type: 'string',
        validValues: ["'hello'", "''", 'product'],
        invalidValues: [
          { value: '123', actualType: BasicParamTypes.Number },
          { value: 'true', actualType: BasicParamTypes.Boolean },
        ],
      },
      {
        type: 'number',
        validValues: ['0', '123', '-1', 'product'],
        invalidValues: [
          { value: "'hello'", actualType: BasicParamTypes.String },
          { value: 'true', actualType: BasicParamTypes.Boolean },
        ],
      },
      {
        type: 'boolean',
        validValues: ['true', 'false', 'nil', 'empty', 'product', '123', "'hello'"],
        invalidValues: [],
      },
      {
        type: 'object',
        validValues: ['product', '(1..3)'],
        invalidValues: [
          { value: "'hello'", actualType: BasicParamTypes.String },
          { value: '123', actualType: BasicParamTypes.Number },
          { value: 'true', actualType: BasicParamTypes.Boolean },
          { value: 'empty', actualType: BasicParamTypes.Boolean },
        ],
      },
    ];

    for (const test of typeTests) {
      describe(`${test.type} validation`, () => {
        const makeBlock = (type: string) => `
          {% doc %}
            @param {${type}} param - Description
          {% enddoc %}
          <div>{{ param }}</div>
        `;

        test.validValues.forEach((value) => {
          it(`should accept ${value} for ${test.type}`, async () => {
            const sourceCode = `{% content_for 'block', type: 'card', param: ${value} %}`;
            const offenses = await runLiquidCheck(
              ValidContentForArgumentTypes,
              sourceCode,
              undefined,
              {},
              {
                'blocks/card.liquid': makeBlock(test.type),
              },
            );
            expect(offenses).toHaveLength(0);
          });
        });

        test.invalidValues.forEach(({ value, actualType: expectedType }) => {
          it(`should reject ${value} for ${test.type}`, async () => {
            const sourceCode = `{% content_for 'block', type: 'card', param: ${value} %}`;
            const offenses = await runLiquidCheck(
              ValidContentForArgumentTypes,
              sourceCode,
              undefined,
              {},
              {
                'blocks/card.liquid': makeBlock(test.type),
              },
            );
            expect(offenses).toHaveLength(1);
            expect(offenses[0].message).toBe(
              `Type mismatch for argument 'param': expected ${test.type}, got ${expectedType}`,
            );
          });
        });
      });
    }
  });

  describe('edge cases', () => {
    it('should handle mixed case type annotations', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', text: "hello", count: 5, flag: true, data: product %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
            {% doc %}
              @param {String} text - The text
              @param {NUMBER} count - The count
              @param {BOOLEAN} flag - The flag
              @param {Object} data - The data
            {% enddoc %}
            <div>{{ text }}{{ count }}{{ flag }}{{ data }}</div>
          `,
        },
      );
      expect(offenses).toHaveLength(0);
    });

    it('should ignore variable lookups', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: product_title %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
            {% doc %}
              @param {String} title - The title
            {% enddoc %}
            <div>{{ title }}</div>
          `,
        },
      );
      expect(offenses).toHaveLength(0);
    });

    it('should not report when snippet has no doc comment', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `<h1>This snippet has no doc comment</h1>`,
        },
      );
      expect(offenses).toHaveLength(0);
    });

    it('should not enforce unsupported types', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
            {% doc %}
              @param {Unsupported} title - The title
            {% enddoc %}
            <div>{{ title }}</div>
          `,
        },
      );
      expect(offenses).toHaveLength(0);
    });

    it('should not report for unrecognized arguments', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: "hello", unrecognized: 123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
            {% doc %}
              @param {String} title - The title
            {% enddoc %}
            <div>{{ title }}</div>
          `,
        },
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('suggestions', () => {
    const makeBlock = (type: string) => `
      {% doc %}
        @param {${type}} param - Description
      {% enddoc %}
      <div>{{ param }}</div>
    `;

    it('should suggest replacing with default value for type or removing value', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param: 123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('string'),
        },
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].suggest).toHaveLength(2);
      expect(offenses[0].suggest?.[0]?.message).toBe("Replace with default value '''' for string");

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card', param: '' %}`);

      const suggestions = applySuggestions(sourceCode, offenses[0]);
      expect(suggestions?.[1]).toEqual(`{% content_for 'block', type: 'card', param:  %}`);
    });

    it('should allow users to fix a single argument when multiple are provided`', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 123, count: 5 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
          {% doc %}
            @param {string} title - The title
            @param {number} count - The count
          {% enddoc %}
          <div>{{ title }} {{ count }}</div>
        `,
        },
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Type mismatch for argument 'title': expected string, got number",
      );

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card', title: '', count: 5 %}`);
    });

    it('should handle arguments with trailing commas', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param: 123, %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('string'),
        },
      );

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card', param: '', %}`);
    });

    it('should handle arguments with complex spacing', async () => {
      const sourceCode = `{% content_for 'block', type: 'card',
        title: 123,
        count: 5
      %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
          {% doc %}
            @param {string} title - The title
            @param {number} count - The count
          {% enddoc %}
        `,
        },
      );

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card',
        title: '',
        count: 5
      %}`);
    });

    it('should handle argument with no space after colon', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param:123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('string'),
        },
      );

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card', param:'' %}`);
    });

    it('should handle argument with multiple spaces after colon', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param:     123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('string'),
        },
      );

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card', param:     '' %}`);
    });

    it('should handle argument with newlines', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param: 
        123 
      %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('string'),
        },
      );

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% content_for 'block', type: 'card', param: 
        '' 
      %}`);
    });

    it('should suggest removal and replacement if expected type has a default value', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param: 123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('string'),
        },
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].suggest).toHaveLength(2);
      expect(offenses[0].suggest?.[0]?.message).toBe("Replace with default value '''' for string");
      expect(offenses[0].suggest?.[1]?.message).toBe('Remove value');
    });

    it("should only suggest removal if expected type default value is ''", async () => {
      const sourceCode = `{% content_for 'block', type: 'card', param: 123 %}`;
      const offenses = await runLiquidCheck(
        ValidContentForArgumentTypes,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': makeBlock('object'),
        },
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].suggest).toHaveLength(1);
      expect(offenses[0].suggest?.[0]?.message).toBe('Remove value');
    });
  });
});
