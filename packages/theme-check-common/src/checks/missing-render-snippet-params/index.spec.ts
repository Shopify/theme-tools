import { describe, it, expect } from 'vitest';
import { applySuggestions, runLiquidCheck } from '../../test';
import { MissingRenderSnippetParams } from '.';
import { MockFileSystem } from '../../test';

function check(snippet: string, source: string) {
  return runLiquidCheck(MissingRenderSnippetParams, source, undefined, {
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

describe('Module: MissingRenderSnippetParams', () => {
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
  });

  describe('suggestions', () => {
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

    it('should suggest adding missing parameter after provided alias variable', async () => {
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

      let sourceCode = `{% render 'card' as title %}`;
      let offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Missing required parameter 'description' in render tag for snippet 'card'",
      );

      let result = applySuggestions(sourceCode, offenses[0]);
      expect(result).toEqual([`{% render 'card' as title, description: '' %}`]);

      sourceCode = `{% render 'card' for titles as title %}`;
      offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(
        "Missing required parameter 'description' in render tag for snippet 'card'",
      );

      result = applySuggestions(sourceCode, offenses[0]);
      expect(result).toEqual([`{% render 'card' for titles as title, description: '' %}`]);
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
      const offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });
      expect(offenses).toHaveLength(0);
    });

    it('should not report when snippet has no doc comment', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `<h1>This snippet has no doc comment</h1>`,
      });

      const sourceCode = `{% render 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
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
      const offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);
    });

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
      const offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(0);
    });

    it('should report when "with/for" alias syntax is used', async () => {
      const fs = new MockFileSystem({
        'snippets/card.liquid': `
          {% doc %}
            @param {string} title - The title of the card
          {% enddoc %}
          <div>{{ title }}</div>  
        `,
      });

      let sourceCode = `{% render 'card' with 'my-card' as unknown %}`;
      let offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toEqual(
        "Missing required parameter 'title' in render tag for snippet 'card'",
      );

      sourceCode = `{% render 'card' for array as unknown %}`;
      offenses = await runLiquidCheck(MissingRenderSnippetParams, sourceCode, undefined, {
        fs,
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toEqual(
        "Missing required parameter 'title' in render tag for snippet 'card'",
      );
    });
  });
});
