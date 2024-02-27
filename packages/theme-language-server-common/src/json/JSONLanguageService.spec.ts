import { JsonValidationSet, ValidateFunction } from '@shopify/theme-check-common';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { CompletionParams, HoverParams, ClientCapabilities } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { JSONLanguageService } from './JSONLanguageService';

const simplifiedSectionSchema = JSON.stringify({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      description: 'The section title shown in the theme editor',
    },
    class: {
      type: 'string',
      description: 'Additional CSS class for the section',
    },
  },
});

const simplifiedTranslationSchema = JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: {
    oneOf: [
      {
        type: 'string',
      },
      {
        $ref: '#/$defs/pluralizedString',
      },
      {
        $ref: '#',
      },
    ],
  },
  $defs: {
    pluralizedString: {
      type: 'object',
      properties: {
        one: {
          type: 'string',
          description: 'Translation for the singular form',
        },
        other: {
          type: 'string',
          description: 'Translation for the plural form',
        },
      },
      additionalProperties: false,
      description: 'An object representing a pluralized translation string',
    },
  },
});

describe('Module: JSONLanguageService', () => {
  let jsonLanguageService: JSONLanguageService;
  let documentManager: DocumentManager;

  beforeEach(() => {
    documentManager = new DocumentManager();
    jsonLanguageService = new JSONLanguageService(documentManager, {
      async validateSectionSchema() {
        const mockValidator: ValidateFunction = () => {
          mockValidator.errors = [];
          return false;
        };
        return mockValidator;
      },

      async sectionSchema() {
        return simplifiedSectionSchema;
      },

      async translationSchema() {
        return simplifiedTranslationSchema;
      },
    });

    jsonLanguageService.setup({
      textDocument: {
        completion: {
          contextSupport: true,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown'],
            deprecatedSupport: true,
            preselectSupport: true,
          },
        },
      },
    });
  });

  describe('completions', () => {
    it('should return section JSON schema completions in a section file {% schema %}', async () => {
      const params = getParams(
        documentManager,
        'sections/section.liquid',
        `
          <div>hello world</div>
          {% schema %}
            {
              "name": "My section",
              "█"
            }
          {% endschema %}
        `,
      );

      const completions = await jsonLanguageService.completions(params);
      assert(
        typeof completions === 'object' && completions !== null && !Array.isArray(completions),
      );
      expect(completions.items).to.have.lengthOf(1);
      expect(completions.items[0].label).to.equal('class');
      expect(completions.items[0].documentation).to.equal('Additional CSS class for the section');
    });

    it('should return translation key completions in a theme translation file', async () => {
      const paths = [
        'locales/en.default.json',
        'locales/en.default.schema.json',
        'locales/fr.json',
        'locales/fr.schema.json',
      ];
      for (const path of paths) {
        const params = getParams(
          documentManager,
          path,
          `
            {
              "general": {
                "hello": {
                  "other": "hey folks",
                  "█"
                }
              }
            }
          `,
        );
        const completions = await jsonLanguageService.completions(params);
        assert(
          typeof completions === 'object' && completions !== null && !Array.isArray(completions),
        );
        expect(completions.items).to.have.lengthOf(1);
        expect(completions.items[0].label).to.equal('one');
        expect(completions.items[0].documentation).to.eql('Translation for the singular form');
      }
    });
  });

  describe('hover', () => {
    it('should return hover information for the given property in a section {% schema %}', async () => {
      const params = getParams(
        documentManager,
        'sections/section.liquid',
        `
          <div>hello world</div>
          {% schema %}
            {
              "name█": "My section"
            }
          {% endschema %}
        `,
      );
      const hover = await jsonLanguageService.hover(params);
      assert(hover !== null);
      expect(hover.contents).to.eql(['The section title shown in the theme editor']);
    });

    it('should return the path of a translation key in a theme translation file', async () => {
      const paths = ['locales/en.default.json', 'locales/fr.json'];
      for (const path of paths) {
        const params = getParams(
          documentManager,
          path,
          `
            {
              "general": {
                "hello█": "world"
              }
            }
          `,
        );
        const hover = await jsonLanguageService.hover(params);
        assert(hover !== null);
        expect(hover.contents).to.eql([{ language: 'liquid', value: `{{ 'general.hello' | t }}` }]);
      }
    });

    it('should return add interpolated variables to the hover', async () => {
      const paths = ['locales/en.default.json', 'locales/fr.json'];
      for (const path of paths) {
        const params = getParams(
          documentManager,
          path,
          `
            {
              "general": {
                "hello█": " {{ var1 }} world {{ var2 }}"
              }
            }
          `,
        );
        const hover = await jsonLanguageService.hover(params);
        assert(hover !== null);
        expect(hover.contents).to.eql([
          { language: 'liquid', value: `{{ 'general.hello' | t: var1: var1, var2: var2 }}` },
        ]);
      }
    });

    it('should return translation group hover for non-leaf nodes', async () => {
      const paths = ['locales/en.default.json', 'locales/fr.json'];
      for (const path of paths) {
        const params = getParams(
          documentManager,
          path,
          `
            {
              "general█": {
                "hello": " {{ var1 }} world {{ var2 }}"
              }
            }
          `,
        );
        const hover = await jsonLanguageService.hover(params);
        assert(hover !== null);
        expect(hover.contents).to.eql([`Translation group: general`]);
      }
    });

    it('should return the parent translation key for pluralized translations', async () => {
      const paths = ['locales/en.default.json', 'locales/fr.json'];
      for (const path of paths) {
        const params = getParams(
          documentManager,
          path,
          `
            {
              "general": {
                "one█": " {{ var1 }} world"
              }
            }
          `,
        );
        const hover = await jsonLanguageService.hover(params);
        assert(hover !== null);
        expect(hover.contents).to.eql([
          { language: 'liquid', value: `{{ 'general' | t: var1: var1 }}` },
        ]);
      }
    });

    it('should return the t:path of a translation key in a schema translation file', async () => {
      const paths = ['locales/en.default.schema.json', 'locales/fr.schema.json'];
      for (const path of paths) {
        const params = getParams(
          documentManager,
          path,
          `
            {
              "general": {
                "hello█": "world"
              }
            }
          `,
        );
        const hover = await jsonLanguageService.hover(params);
        assert(hover !== null);
        expect(hover.contents).to.eql([{ language: 'json', value: `"t:general.hello"` }]);
      }
    });
  });

  function getParams(
    documentManager: DocumentManager,
    relativePath: string,
    source: string,
  ): HoverParams & CompletionParams {
    const uri = `file:///root/${relativePath}`;
    const sourceWithoutCursor = source.replace('█', '');
    documentManager.open(uri, sourceWithoutCursor, 1);
    const doc = documentManager.get(uri)!.textDocument;
    const position = doc.positionAt(source.indexOf('█'));

    return {
      textDocument: { uri: uri },
      position: position,
    };
  }
});
