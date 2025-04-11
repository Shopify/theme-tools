import { describe, it, expect } from 'vitest';
import { applySuggestions, MockTheme, runLiquidCheck } from '../../test';
import { UnrecognizedRenderSnippetParams } from '.';

function check(snippet: string, source: string) {
  return runLiquidCheck(
    UnrecognizedRenderSnippetParams,
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
  describe('unknown parameters', () => {
    it('should report unknown parameters that are provided in the render markup', async () => {
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
        "Unknown parameter 'unknown_param' in render tag for snippet 'card'",
      );
      expect(offenses[1].message).toBe(
        "Unknown parameter 'second_unknown_param' in render tag for snippet 'card'",
      );
    });
  });

  describe('suggestions', () => {
    it('should properly remove unknown parameters when the only parameter is unknown', async () => {
      let sourceCode = `{% render 'card', unknown_param: 'value' %}`;
      let offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1); // Only the unknown param offense
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when there are multiple parameters with no leading whitespaces', async () => {
      const sourceCode = `{% render 'card',unknown_param: 'value', required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when there are multiple parameters', async () => {
      const sourceCode = `{% render 'card', unknown_param: 'value', required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when it has trailing whitespace', async () => {
      const sourceCode = `{% render 'card', unknown_param: 'value'  , required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when it has leading whitespace', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value', required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when it has no trailing comma and is the only param', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when it has a trailing comma and is the only param', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value', %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when it has trailing comma and is the last of multiple params', async () => {
      const sourceCode = `{% render 'card', required_string: '', unknown_param: 'value', %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: '' %}`]);
    });

    it('should properly remove an unknown parameter when it has no trailing comma and is the last of multiple params', async () => {
      const sourceCode = `{% render 'card', required_string: '',   unknown_param: 'value' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: '' %}`]);
    });

    it('should properly remove parameter from the correct render tag when multiple are present', async () => {
      const sourceCode = `{% render 'card', unknown_param: 'value' %}\n{% render 'card', second_unknown_param: 'value' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses[0].message).toBe(
        "Unknown parameter 'unknown_param' in render tag for snippet 'card'",
      );
      expect(offenses[1].message).toBe(
        "Unknown parameter 'second_unknown_param' in render tag for snippet 'card'",
      );

      expect(offenses).toHaveLength(2);
      const suggestionResult = applySuggestions(sourceCode, offenses[1]);
      expect(suggestionResult).toEqual([
        `{% render 'card', unknown_param: 'value' %}\n{% render 'card' %}`,
      ]);

      const suggestionResult2 = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult2).toEqual([
        `{% render 'card' %}\n{% render 'card', second_unknown_param: 'value' %}`,
      ]);
    });
  });

  describe('edge cases', () => {
    it('should not report when snippet has no doc comment', async () => {
      const sourceCode = `{% render 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetParams,
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
        UnrecognizedRenderSnippetParams,
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
        UnrecognizedRenderSnippetParams,
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
        UnrecognizedRenderSnippetParams,
        sourceCode,
        undefined,
        {},
        mockTheme,
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Unknown parameter 'unknown_param' in render tag for snippet 'card'",
      );
      expect(offenses[0].start.index).toBe(sourceCode.indexOf(' with'));
      expect(offenses[0].end.index).toBe(
        sourceCode.indexOf('unknown_param') + 'unknown_param'.length,
      );

      sourceCode = `{% render 'card' for array as unknown_param %}`;
      offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetParams,
        sourceCode,
        undefined,
        {},
        mockTheme,
      );

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Unknown parameter 'unknown_param' in render tag for snippet 'card'",
      );
      expect(offenses[0].start.index).toBe(sourceCode.indexOf(' for'));
      expect(offenses[0].end.index).toBe(
        sourceCode.indexOf('unknown_param') + 'unknown_param'.length,
      );
    });

    it('should correctly suggest removing aliases with variable whitespace', async () => {
      let sourceCode = `{% render 'card' with 'my-card'       as   unknown_param %}`;
      let offenses = await runLiquidCheck(
        UnrecognizedRenderSnippetParams,
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
