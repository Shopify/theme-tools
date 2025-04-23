import { describe, it, expect } from 'vitest';
import { applySuggestions, MockTheme, runLiquidCheck } from '../../test';
import { UnrecognizedRenderSnippetArguments } from '.';

function check(snippet: string, source: string) {
  return runLiquidCheck(
    UnrecognizedRenderSnippetArguments,
    source,
    undefined,
    {},
    {
      'snippets/card.liquid': snippet,
    },
  );
}

const defaultSnippet = `
  {% doc %}
    @param {string} required_string - A required string
    @param {number} required_number - A required number
    @param {boolean} required_boolean - A required boolean
    @param {object} required_object - A required object
    @param {string} [optional_string] - An optional string
    @param {number} [optional_number] - An optional number
    @param {object} [optional_object] - An optional object
    @param {boolean} [optional_boolean] - An optional boolean
  {% enddoc %}
`;

describe('Module: UnrecognizedRenderSnippetParams', () => {
  describe('unknown arguments', () => {
    it('should report unknown arguments that are provided in the render markup', async () => {
      const sourceCode = `
        {% render 'card',
        required_string: 'My Card',
        required_number: 1,
        required_boolean: true,
        required_object: product,
        unknown_param: 'unknown',
        second_unknown_param: 'second unknown',
        %}
        `;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(2);
      expect(offenses[0].message).toBe(
        "Unknown argument 'unknown_param' in render tag for snippet 'card'.",
      );
      expect(offenses[1].message).toBe(
        "Unknown argument 'second_unknown_param' in render tag for snippet 'card'.",
      );
    });
  });

  describe('edge cases', () => {
    it('should not report when snippet has no doc comment', async () => {
      const sourceCode = `{% render 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetArguments,
        sourceCode,
        undefined,
        {},
        {
          'snippets/card.liquid': `<h1>This snippet has no doc comment</h1>`,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when LiquidDoc definition has no defined params', async () => {
      const sourceCode = `{% render 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetArguments,
        sourceCode,
        undefined,
        {},
        {
          'snippets/card.liquid': `
              {% doc %}
                @description this is a description
                @example this is an example
              {% enddoc %}
              <div>{{ title }}</div>
              <div>{{ description }}</div>
            `,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when snippet name is a VariableLookup', async () => {
      const sourceCode = `{% assign snippet_name = 'card' %}{% render snippet_name, title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetArguments,
        sourceCode,
        undefined,
        {},
        {
          'snippets/card.liquid': `
              {% doc %}
                @param {string} title - The title of the card
                @param {string} description - The description of the card
              {% enddoc %}
              <div>{{ title }}</div>
              <div>{{ description }}</div>
            `,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should report when "with/for" alias syntax is used', async () => {
      const mockTheme = {
        'snippets/card.liquid': `
          {% doc %}
            @param {string} title - The title of the card
          {% enddoc %}
          <div>{{ title }}</div>
        `,
      } as MockTheme;

      let sourceCode = `{% render 'card' with 'my-card' as unknown_param %}`;
      let offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetArguments,
        sourceCode,
        undefined,
        {},
        mockTheme,
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Unknown argument 'unknown_param' in render tag for snippet 'card'.",
      );
      expect(offenses[0].start.index).toBe(sourceCode.indexOf('with'));
      expect(offenses[0].end.index).toBe(
        sourceCode.indexOf('unknown_param') + 'unknown_param'.length,
      );

      sourceCode = `{% render 'card' for array as unknown_param %}`;
      offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetArguments,
        sourceCode,
        undefined,
        {},
        mockTheme,
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Unknown argument 'unknown_param' in render tag for snippet 'card'.",
      );
      expect(offenses[0].start.index).toBe(sourceCode.indexOf('for'));
      expect(offenses[0].end.index).toBe(
        sourceCode.indexOf('unknown_param') + 'unknown_param'.length,
      );
    });

    it('should correctly suggest removing aliases with variable whitespace', async () => {
      let sourceCode = `{% render 'card' with 'my-card'       as   unknown_param %}`;
      let offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetArguments,
        sourceCode,
        undefined,
        {},
        {
          'snippets/card.liquid': `
          {% doc %}
            @param {string} title - The title of the card
          {% enddoc %}
          <div>{{ title }}</div>
        `,
        },
      );

      expect(offenses).toHaveLength(1);
      let result = applySuggestions(sourceCode, offenses[0]);
      expect(result).toEqual([`{% render 'card' %}`]);
    });
  });
});
