import { describe, it, expect } from 'vitest';
import { applySuggestions, runLiquidCheck } from '../../test';
import { ValidRenderSnippetParams } from '.';
import { MockFileSystem } from '../../test';

function check(snippet: string, source: string) {
  return runLiquidCheck(ValidRenderSnippetParams, source, undefined, {
    fs: new MockFileSystem({
      'snippets/card.liquid': snippet,
    }),
  });
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

describe('Module: ValidRenderSnippetParams', () => {
  describe('missing required parameters', () => {
    it('should report missing required parameters', async () => {
      const offenses = await check(defaultSnippet, `{% render 'card' %}`);

      expect(offenses).toHaveLength(4);
      expect(offenses[0].message).toBe(
        "Missing required parameter 'required_string' in render tag for snippet 'card'",
      );
      expect(offenses[1].message).toBe(
        "Missing required parameter 'required_number' in render tag for snippet 'card'",
      );
      expect(offenses[2].message).toBe(
        "Missing required parameter 'required_boolean' in render tag for snippet 'card'",
      );
      expect(offenses[3].message).toBe(
        "Missing required parameter 'required_object' in render tag for snippet 'card'",
      );
    });

    it('should suggest adding missing required parameters when none already exist', async () => {
      const sourceCode = `{% render 'card' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(4);
      const x = applySuggestions(sourceCode, offenses[0]);
      expect(x).toEqual([`{% render 'card', required_string: '' %}`]);
    });

    it('should suggest adding missing required parameters with proper comma handling', async () => {
      const sourceCode = `{% render 'card', required_string: 'value' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(3); // Will have other missing required params
      const x = applySuggestions(sourceCode, offenses[0]);
      expect(x).toEqual([`{% render 'card', required_string: 'value', required_number: 0 %}`]);
    });

    it('should suggest adding missing required parameters with trailing comma and whitespace', async () => {
      const sourceCode = `{% render 'card', required_string: 'value',    %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(3);
      const x = applySuggestions(sourceCode, offenses[0]);
      expect(x).toEqual([`{% render 'card', required_string: 'value', required_number: 0 %}`]);
    });

    it('should suggest adding missing required parameters with trailing comma and space', async () => {
      const sourceCode = `{% render 'card', required_string: 'value' , %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(3);
      const x = applySuggestions(sourceCode, offenses[0]);
      expect(x).toEqual([`{% render 'card', required_string: 'value', required_number: 0 %}`]);
    });
  });

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

    it('should properly remove unknown parameters when the only parameter is unknown', async () => {
      let sourceCode = `{% render 'card', unknown_param: 'value' %}`;
      let offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(5); // Will have missing required params too
      const suggestionResult = applySuggestions(sourceCode, offenses[4]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when there are multiple parameters with no leading whitespaces', async () => {
      const sourceCode = `{% render 'card',unknown_param: 'value', required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(4);
      const suggestionResult = applySuggestions(sourceCode, offenses[3]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when there are multiple parameters', async () => {
      const sourceCode = `{% render 'card', unknown_param: 'value', required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(4);
      const suggestionResult = applySuggestions(sourceCode, offenses[3]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when it has trailing whitespace', async () => {
      const sourceCode = `{% render 'card', unknown_param: 'value'  , required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(4);
      const suggestionResult = applySuggestions(sourceCode, offenses[3]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when it has leading whitespace', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value', required_string: 'test' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(4);
      const suggestionResult = applySuggestions(sourceCode, offenses[3]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: 'test' %}`]);
    });

    it('should properly remove an unknown parameter when it has no trailing comma and is the only param', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(5);
      const suggestionResult = applySuggestions(sourceCode, offenses[4]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when it has a trailing comma and is the only param', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value', %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(5);
      const suggestionResult = applySuggestions(sourceCode, offenses[4]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when it has trailing comma and is the last of multiple params', async () => {
      const sourceCode = `{% render 'card',     unknown_param: 'value', %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(5);
      const suggestionResult = applySuggestions(sourceCode, offenses[4]);
      expect(suggestionResult).toEqual([`{% render 'card' %}`]);
    });

    it('should properly remove an unknown parameter when it has no trailing comma and is the last of multiple params', async () => {
      const sourceCode = `{% render 'card', required_string: '',   unknown_param: 'value' %}`;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(4);
      const suggestionResult = applySuggestions(sourceCode, offenses[3]);
      expect(suggestionResult).toEqual([`{% render 'card', required_string: '' %}`]);
    });
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
      const offenses = await runLiquidCheck(ValidRenderSnippetParams, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should not report when snippet has no doc comment', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `<h1>This snippet has no doc comment</h1>`,
      });

      const sourceCode = `{% render 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);
    });

    it('should not report when LiquidDoc definition has no defined params', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
            {% doc %}
              @description this is a description
              @example this is an example
            {% enddoc %}
            <div>{{ title }}</div>
            <div>{{ description }}</div>
          `,
      });

      const sourceCode = `{% render 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);
    });

    // We need to know the runtime value of the variable in order to do this
    it('should not report when snippet name is a VariableLookup', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
            {% doc %}
              @param {string} title - The title of the card
              @param {string} description - The description of the card
            {% enddoc %}
            <div>{{ title }}</div>
            <div>{{ description }}</div>
          `,
      });

      const sourceCode = `{% assign snippet_name = 'card' %}{% render snippet_name, title: 'My Card' %}`;
      const offenses = await runLiquidCheck(ValidRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);
    });

    it('should not report when "with/for" alias syntax is used', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
          {% doc %}
            @param {string} title - The title of the card
          {% enddoc %}
          <div>{{ title }}</div>  
        `,
      });

      let sourceCode = `{% render 'card' with 'my-card' as title %}`;
      let offenses = await runLiquidCheck(ValidRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);

      sourceCode = `{% render 'card' for array as title %}`;
      offenses = await runLiquidCheck(ValidRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);
    });
  });
});
