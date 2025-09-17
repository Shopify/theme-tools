import { Mode, Translations } from '@shopify/theme-check-common';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../documents';
import { JSONLanguageService } from './JSONLanguageService';
import { getRequestParams, isCompletionList } from './test/test-helpers';

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
    disabled_on: {
      type: 'string',
    },
  },
});

const simplifiedTaeBlockSchema = JSON.stringify({
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
    javascript: {
      type: 'string',
      description: 'Haha this one is different',
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
  let schemaTranslations: Translations;

  beforeEach(async () => {
    schemaTranslations = {};
    documentManager = new DocumentManager(
      undefined,
      undefined,
      undefined,
      async () => 'theme', // theme schema
      async () => false, // invalid
    );
    jsonLanguageService = new JSONLanguageService(
      documentManager,
      {
        schemas: async (mode: Mode) => [
          {
            uri: 'https://shopify.dev/section-schema.json',
            schema: simplifiedSectionSchema,
            fileMatch: ['**/sections/*.liquid'],
          },
          {
            uri: 'https://shopify.dev/translation-schema.json',
            schema: simplifiedTranslationSchema,
            fileMatch: ['**/locales/*.json'],
          },
          {
            uri:
              mode === 'theme'
                ? 'https://shopify.dev/block-schema.json'
                : 'https://shopify.dev/block-tae-schema.json',
            schema: mode === 'theme' ? simplifiedSectionSchema : simplifiedTaeBlockSchema,
            fileMatch: ['**/blocks/*.liquid'],
          },
        ],
      },
      () => Promise.resolve(schemaTranslations),
      (uri: string) => Promise.resolve(uri.includes('tae') ? 'app' : 'theme'),
      () => Promise.resolve([]),
      async () => undefined,
      async () => 'file:///test-root',
    );

    await jsonLanguageService.setup({
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
      const params = getRequestParams(
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
      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(2);
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
        const params = getRequestParams(
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
        assert(isCompletionList(completions));
        expect(completions.items).to.have.lengthOf(1);
        expect(completions.items[0].label).to.equal('one');
        expect(completions.items[0].documentation).to.eql('Translation for the singular form');
      }
    });

    it('should be possible to offer theme app extension completions in app contexts, and theme completions in theme contexts for blocks', async () => {
      const testContexts: [Mode, string, string[]][] = [
        ['theme', 'theme/blocks/block.liquid', ['class', 'disabled_on']],
        ['app', 'tae/blocks/block.liquid', ['class', 'javascript']],
      ];
      for (const [mode, path, expectedRecommendations] of testContexts) {
        const params = getRequestParams(
          documentManager,
          path,
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
        assert(isCompletionList(completions));
        expect(completions.items).to.have.lengthOf(expectedRecommendations.length);
        expect(completions.items).toEqual(
          expectedRecommendations.map((recommendation) =>
            expect.objectContaining({ label: recommendation }),
          ),
        );
      }
    });

    it('should complete t:translations', async () => {
      schemaTranslations = {
        general: {
          hello: 'hello world',
          hi: 'hi world',
        },
      };

      const params = getRequestParams(
        documentManager,
        'sections/section.liquid',
        `
          <div>hello world</div>
          {% schema %}
            {
              "name": "t:█"
            }
          {% endschema %}
        `,
      );

      const completions = await jsonLanguageService.completions(params);
      assert(isCompletionList(completions));
      expect(completions.items).to.have.lengthOf(2);
      expect(completions.items[0].label).to.equal('t:general.hello');
      expect(completions.items[0].documentation).to.eql({
        kind: 'markdown',
        value: 'hello world',
      });
    });
  });

  describe('hover', () => {
    it('should return hover information for the given property in a section {% schema %}', async () => {
      const params = getRequestParams(
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

    it('should return the translation value of a t:translation', async () => {
      schemaTranslations = {
        general: {
          hello: 'hello world',
        },
      };
      const params = getRequestParams(
        documentManager,
        'sections/section.liquid',
        `
          <div>hello world</div>
          {% schema %}
            {
              "name": "t:general.hello█"
            }
          {% endschema %}
        `,
      );
      const hover = await jsonLanguageService.hover(params);
      assert(hover !== null);
      expect(hover.contents).to.eql(['hello world']);
    });

    it('should return the path of a translation key in a theme translation file', async () => {
      const paths = ['locales/en.default.json', 'locales/fr.json'];
      for (const path of paths) {
        const params = getRequestParams(
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
        const params = getRequestParams(
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
        const params = getRequestParams(
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
        const params = getRequestParams(
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
        const params = getRequestParams(
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

  describe('isValidSchema', () => {
    it('should return true for a valid schema', async () => {
      const params = getRequestParams(
        documentManager,
        'sections/section.liquid',
        `
          <div>hello world</div>
          {% schema %}
            { "name": "hello world" }
          {% endschema %}
        `,
      );
      const isValid = await jsonLanguageService.isValidSchema(
        params.textDocument.uri,
        '{ "name": "hello world" }',
      );
      expect(isValid).to.be.true;
    });

    it('should return false for an invalid schema', async () => {
      const params = getRequestParams(
        documentManager,
        'sections/section.liquid',
        `
          <div>hello world</div>
          {% schema %}
            { "invalid": true }
          {% endschema %}
        `,
      );
      const isValid = await jsonLanguageService.isValidSchema(
        params.textDocument.uri,
        '{ "invalid": true }',
      );
      expect(isValid).to.be.false;
    });
  });
});
