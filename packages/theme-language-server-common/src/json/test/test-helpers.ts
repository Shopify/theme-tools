import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  HoverParams,
} from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { GetThemeBlockNames } from '../JSONContributions';
import { JSONLanguageService } from '../JSONLanguageService';
import { SourceCodeType } from '@shopify/theme-check-common';
import { GetTranslationsForURI } from '../../translations';

export function getRequestParams(
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

export function isCompletionList(
  completions: null | CompletionList | CompletionItem[],
): completions is CompletionList {
  return completions !== null && !Array.isArray(completions);
}

export function mockJSONLanguageService(
  rootUri: string,
  documentManager: DocumentManager,
  getDefaultSchemaTranslations: GetTranslationsForURI = async () => ({}),
  getThemeBlockNames: GetThemeBlockNames = async () => [],
) {
  return new JSONLanguageService(
    documentManager,
    {
      schemas: async () => [
        {
          uri: 'https://shopify.dev/block-schema.json',
          schema: JSON.stringify({
            $schema: 'http://json-schema.org/draft-07/schema#',
          }),
          fileMatch: ['**/{blocks,sections}/*.liquid'],
        },
      ],
    },
    getDefaultSchemaTranslations,
    async () => 'theme',
    getThemeBlockNames,
    async (_uri: string, name: string) => {
      const blockUri = `${rootUri}/blocks/${name}.liquid`;
      const doc = documentManager.get(blockUri);
      if (!doc || doc.type !== SourceCodeType.LiquidHtml) {
        return;
      }
      return doc.getSchema();
    },
  );
}
