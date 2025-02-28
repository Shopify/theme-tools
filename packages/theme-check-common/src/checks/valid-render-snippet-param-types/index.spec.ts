import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applySuggestions } from '../../test';
import { ValidRenderSnippetParamTypes } from '.';
import { MockFileSystem } from '../../test';
import { SupportedParamTypes } from '../../liquid-doc/utils';

describe('Module: ValidRenderSnippetParamTypes', () => {
  describe('type validation', () => {
    const typeTests = [
      {
        type: 'string',
        validValues: ["'hello'", "''", 'product'],
        invalidValues: [
          { value: '123', actualType: SupportedParamTypes.Number },
          { value: 'true', actualType: SupportedParamTypes.Boolean },
        ],
      },
      {
        type: 'number',
        validValues: ['0', '123', '-1', 'product'],
        invalidValues: [
          { value: "'hello'", actualType: SupportedParamTypes.String },
          { value: 'true', actualType: SupportedParamTypes.Boolean },
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
          { value: "'hello'", actualType: SupportedParamTypes.String },
          { value: '123', actualType: SupportedParamTypes.Number },
          { value: 'true', actualType: SupportedParamTypes.Boolean },
          { value: 'empty', actualType: SupportedParamTypes.Boolean },
        ],
      },
    ];

    for (const test of typeTests) {
      describe(`${test.type} validation`, () => {
        const makeSnippet = (type: string) => `
          {% doc %}
            @param {${type}} param - Description
          {% enddoc %}
          <div>{{ param }}</div>
        `;

        test.validValues.forEach((value) => {
          it(`should accept ${value} for ${test.type}`, async () => {
            const fs = new MockFileSystem({
              'snippets/card.liquid': makeSnippet(test.type),
            });

            const sourceCode = `{% render 'card', param: ${value} %}`;
            const offenses = await runLiquidCheck(
              ValidRenderSnippetParamTypes,
              sourceCode,
              undefined,
              {
                fs,
              },
            );
            expect(offenses).toHaveLength(0);
          });
        });

        test.invalidValues.forEach(({ value, actualType: expectedType }) => {
          it(`should reject ${value} for ${test.type}`, async () => {
            const fs = new MockFileSystem({
              'snippets/card.liquid': makeSnippet(test.type),
            });

            const sourceCode = `{% render 'card', param: ${value} %}`;
            const offenses = await runLiquidCheck(
              ValidRenderSnippetParamTypes,
              sourceCode,
              undefined,
              {
                fs,
              },
            );
            expect(offenses).toHaveLength(1);
            expect(offenses[0].message).toBe(
              `Type mismatch for parameter 'param': expected ${test.type}, got ${expectedType}`,
            );
          });
        });
      });
    }
  });

  describe('edge cases', () => {
    it('should handle mixed case type annotations', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
            {% doc %}
              @param {String} text - The text
              @param {NUMBER} count - The count
              @param {BOOLEAN} flag - The flag
              @param {Object} data - The data
            {% enddoc %}
            <div>{{ text }}{{ count }}{{ flag }}{{ data }}</div>
          `,
      });

      const sourceCode = `{% render 'card', text: "hello", count: 5, flag: true, data: product %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should ignore variable lookups', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
            {% doc %}
              @param {String} title - The title
            {% enddoc %}
            <div>{{ title }}</div>
          `,
      });

      const sourceCode = `{% render 'card', title: product_title %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should not report when snippet has no doc comment', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `<h1>This snippet has no doc comment</h1>`,
      });

      const sourceCode = `{% render 'card', title: 123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should not enforce unsupported types', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
            {% doc %}
              @param {Unsupported} title - The title
            {% enddoc %}
            <div>{{ title }}</div>
          `,
      });

      const sourceCode = `{% render 'card', title: 123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should not report for unrecognized parameters', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
            {% doc %}
              @param {String} title - The title
            {% enddoc %}
            <div>{{ title }}</div>
          `,
      });

      const sourceCode = `{% render 'card', title: "hello", unrecognized: 123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should report when `with` alias is used', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
          {% doc %}
            @param {String} title - The title
          {% enddoc %}
          <div>{{ title }}</div>
        `,
      });

      const sourceCode = `{% render 'card' with 12 as title %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Type mismatch for parameter 'title': expected string, got number",
      );
    });

    it('should report when `for` alias is used', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
          {% doc %}
            @param {String} title - The title
          {% enddoc %}
          <div>{{ title }}</div>
        `,
      });

      const sourceCode = `{% render 'card' for 123 as title %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Type mismatch for parameter 'title': expected string, got number",
      );
    });
  });

  describe('suggestions', () => {
    const makeSnippet = (type: string) => `
      {% doc %}
        @param {${type}} param - Description
      {% enddoc %}
      <div>{{ param }}</div>
    `;

    it('should suggest replacing with default value for type or removing value', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card', param: 123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].suggest).toHaveLength(2);
      expect(offenses[0].suggest?.[0]?.message).toBe("Replace with default value '''' for string");

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card', param: '' %}`);

      const suggestions = applySuggestions(sourceCode, offenses[0]);
      expect(suggestions?.[1]).toEqual(`{% render 'card', param:  %}`);
    });

    it('should allow users to fix a single parameter when multiple are provided`', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
          {% doc %}
            @param {string} title - The title
            @param {number} count - The count
          {% enddoc %}
          <div>{{ title }} {{ count }}</div>
        `,
      });

      const sourceCode = `{% render 'card', title: 123, count: 5 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Type mismatch for parameter 'title': expected string, got number",
      );

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card', title: '', count: 5 %}`);
    });

    it('should handle parameters with trailing commas', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card', param: 123, %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card', param: '', %}`);
    });

    it('should handle parameters with complex spacing', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
          {% doc %}
            @param {string} title - The title
            @param {number} count - The count
          {% enddoc %}
        `,
      });

      const sourceCode = `{% render 'card',
        title: 123,
        count: 5
      %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card',
        title: '',
        count: 5
      %}`);
    });

    it('should handle parameter with no space after colon', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card', param:123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card', param:'' %}`);
    });

    it('should handle parameter with multiple spaces after colon', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card', param:     123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card', param:     '' %}`);
    });

    it('should handle parameter with newlines', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card', param: 
        123 
      %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card', param: 
        '' 
      %}`);
    });

    it('should suggest removal and replacement if expected type has a default value', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card', param: 123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].suggest).toHaveLength(2);
      expect(offenses[0].suggest?.[0]?.message).toBe("Replace with default value '''' for string");
      expect(offenses[0].suggest?.[1]?.message).toBe('Remove value');
    });

    it("should only suggest removal if expected type default value is ''", async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('object'),
      });

      const sourceCode = `{% render 'card', param: 123 %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].suggest).toHaveLength(1);
      expect(offenses[0].suggest?.[0]?.message).toBe('Remove value');
    });

    it('should handle when aliases `with` syntax is used', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card' with 123 as param %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Type mismatch for parameter 'param': expected string, got number",
      );

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card' with '' as param %}`);
    });

    it('should handle when aliases `for` syntax is used', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': makeSnippet('string'),
      });

      const sourceCode = `{% render 'card' for 123 as param %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParamTypes, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Type mismatch for parameter 'param': expected string, got number",
      );

      const result = applySuggestions(sourceCode, offenses[0]);
      expect(result?.[0]).toEqual(`{% render 'card' for '' as param %}`);
    });
  });
});
