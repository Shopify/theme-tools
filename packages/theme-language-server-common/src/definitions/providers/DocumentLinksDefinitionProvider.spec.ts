import { assert, beforeEach, describe, expect, it } from 'vitest';
import { DefinitionParams, LocationLink } from 'vscode-languageserver-protocol';

import { DocumentManager } from '../../documents';
import { DefinitionProvider } from '../DefinitionProvider';

describe('Module: DocumentLinksDefinitionProvider', () => {
  let provider: DefinitionProvider;
  let documentManager: DocumentManager;

  beforeEach(() => {
    documentManager = new DocumentManager();

    provider = new DefinitionProvider(
      documentManager,
      async () => null,
      async () => null,
      async () => 'file:///theme',
    );
  });

  it('finds definitions for Liquid file references', async () => {
    const lines = [
      "{% render 'stylesheets' %}",
      "{% section 'header' %}",
      "{{ 'theme.css' | asset_url }}",
      "{% content_for 'block', type: 'feature-grid' %}",
    ];
    const liquidContent = lines.join('\n');

    documentManager.open('file:///theme/layout/theme.liquid', liquidContent, 1);

    const cases = [
      {
        line: 0,
        token: 'stylesheets',
        targetUri: 'file:///theme/snippets/stylesheets.liquid',
      },
      {
        line: 1,
        token: 'header',
        targetUri: 'file:///theme/sections/header.liquid',
      },
      {
        line: 2,
        token: 'theme.css',
        targetUri: 'file:///theme/assets/theme.css',
      },
      {
        line: 3,
        token: 'feature-grid',
        targetUri: 'file:///theme/blocks/feature-grid.liquid',
      },
    ];

    for (const testCase of cases) {
      const params: DefinitionParams = {
        textDocument: { uri: 'file:///theme/layout/theme.liquid' },
        position: {
          line: testCase.line,
          character: lines[testCase.line].indexOf(testCase.token) + 1,
        },
      };

      const result = await provider.definitions(params);

      assert(result);
      expect(result).toHaveLength(1);
      assert(LocationLink.is(result[0]));
      expect(result[0].targetUri).toBe(testCase.targetUri);
    }
  });

  it('returns null when cursor is not on a file reference', async () => {
    const source = "{% render 'stylesheets' %}";
    documentManager.open('file:///theme/layout/theme.liquid', source, 1);

    const params: DefinitionParams = {
      textDocument: { uri: 'file:///theme/layout/theme.liquid' },
      position: { line: 0, character: 4 }, // on `render`
    };

    const result = await provider.definitions(params);

    expect(result).toBeNull();
  });
});
