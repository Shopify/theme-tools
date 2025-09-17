import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentManager } from '../../documents';
import { createJSONDocumentLinksVisitor } from './DocumentLinksProvider';
import { toJSONAST, visit } from '@shopify/theme-check-common';
import { URI } from 'vscode-uri';
import { JSONLanguageService } from '../JSONLanguageService';

describe('JSON Document Links', () => {
  let documentManager: DocumentManager;
  let rootUri: string;
  let uriString: string;
  let jsonLanguageService: JSONLanguageService;

  beforeEach(async () => {
    documentManager = new DocumentManager();
    rootUri = 'file:///path/to/project';

    // Create a minimal JSONLanguageService for testing
    jsonLanguageService = new JSONLanguageService(
      documentManager,
      { schemas: async () => [] },
      async () => ({}),
      async () => 'theme',
      async () => [],
      async () => undefined,
      async () => rootUri,
    );

    // Initialize the service to resolve the initialized promise
    await jsonLanguageService.setup({});
  });

  describe('Schema Tags in Liquid Files', () => {
    it('should return document links for block types in schema tags', async () => {
      uriString = 'file:///path/to/sections/header.liquid';
      rootUri = 'file:///path/to/project';

      const schemaContent = `
        {
          "name": "Header",
          "blocks": [
            { "type": "logo" },
            { "type": "navigation" }
          ]
        }
      `;

      const liquidContent = `
        <div>Header content</div>
        
        {% schema %}
        ${schemaContent}
        {% endschema %}
      `;

      documentManager.open(uriString, liquidContent, 1);

      const textDocument = documentManager.get(uriString)!.textDocument;
      const schemaOffset = liquidContent.indexOf(schemaContent);

      const visitor = createJSONDocumentLinksVisitor(
        textDocument,
        URI.parse(rootUri),
        schemaOffset,
      );
      const ast = toJSONAST(schemaContent);

      if (ast instanceof Error) throw ast;
      const result = visit(ast, visitor);

      expect(result).toHaveLength(2);
      expect(result[0].target).toBe('file:///path/to/project/blocks/logo.liquid');
      expect(result[1].target).toBe('file:///path/to/project/blocks/navigation.liquid');
    });

    it('should handle section types in schema tags', async () => {
      uriString = 'file:///path/to/sections/main-collection.liquid';
      rootUri = 'file:///path/to/project';

      const schemaContent = `
        {
          "name": "Collection",
          "blocks": [
            {
              "type": "text",
              "settings": []
            }
          ],
          "presets": [
            {
              "name": "Default",
              "blocks": [
                { "type": "text" }
              ]
            }
          ]
        }
      `;

      const liquidContent = `
        <div>Collection content</div>
        
        {% schema %}
        ${schemaContent}
        {% endschema %}
      `;

      documentManager.open(uriString, liquidContent, 1);

      const textDocument = documentManager.get(uriString)!.textDocument;
      const schemaOffset = liquidContent.indexOf(schemaContent);

      const visitor = createJSONDocumentLinksVisitor(
        textDocument,
        URI.parse(rootUri),
        schemaOffset,
      );
      const ast = toJSONAST(schemaContent);

      if (ast instanceof Error) throw ast;
      const result = visit(ast, visitor);

      // Should find both block type references (in blocks array and in presets)
      expect(result).toHaveLength(2);
      expect(result[0].target).toBe('file:///path/to/project/blocks/text.liquid');
      expect(result[1].target).toBe('file:///path/to/project/blocks/text.liquid');
    });

    it('should not create links for special block types in schema tags', async () => {
      uriString = 'file:///path/to/sections/app-blocks.liquid';
      rootUri = 'file:///path/to/project';

      const schemaContent = `
        {
          "name": "App Blocks",
          "blocks": [
            { "type": "@app" },
            { "type": "@theme" },
            { "type": "custom-block" }
          ]
        }
      `;

      const liquidContent = `
        <div>App blocks section</div>
        
        {% schema %}
        ${schemaContent}
        {% endschema %}
      `;

      documentManager.open(uriString, liquidContent, 1);

      const textDocument = documentManager.get(uriString)!.textDocument;
      const schemaOffset = liquidContent.indexOf(schemaContent);
      const visitor = createJSONDocumentLinksVisitor(
        textDocument,
        URI.parse(rootUri),
        schemaOffset,
      );
      const ast = toJSONAST(schemaContent);

      if (ast instanceof Error) throw ast;
      const result = visit(ast, visitor);

      // Should only create link for custom-block, not @app or @theme
      expect(result).toHaveLength(1);
      expect(result[0].target).toBe('file:///path/to/project/blocks/custom-block.liquid');
    });
  });

  describe('JSON Files', () => {
    it('should return document links for section types in template JSON files', async () => {
      uriString = 'file:///path/to/templates/index.json';

      const jsonContent = `{
        "layout": "theme",
        "sections": {
          "header": {
            "type": "header-section"
          },
          "main": {
            "type": "main-product"
          }
        }
      }`;

      documentManager.open(uriString, jsonContent, 1);

      const result = await jsonLanguageService.documentLinks({
        textDocument: { uri: uriString },
      });

      expect(result).toHaveLength(2);
      expect(result[0].target).toBe('file:///path/to/project/sections/header-section.liquid');
      expect(result[1].target).toBe('file:///path/to/project/sections/main-product.liquid');
    });

    it('should return document links for block types in section JSON files', async () => {
      uriString = 'file:///path/to/sections/settings.json';

      const jsonContent = `{
        "name": "Section with blocks",
        "blocks": [
          { "type": "text" },
          { "type": "image" },
          { "type": "@app" }
        ]
      }`;

      documentManager.open(uriString, jsonContent, 1);

      const result = await jsonLanguageService.documentLinks({
        textDocument: { uri: uriString },
      });

      expect(result).toHaveLength(2);
      expect(result[0].target).toBe('file:///path/to/project/blocks/text.liquid');
      expect(result[1].target).toBe('file:///path/to/project/blocks/image.liquid');
      // @app should not create a link
    });
  });
});
