import { deepGet } from '@shopify/theme-check-common';
import { CompletionItemKind, JSONPath } from 'vscode-json-languageservice';
import {
  GetTranslationsForURI,
  renderTranslation,
  translationOptions,
} from '../../../translations';
import { isLiquidRequestContext, RequestContext } from '../../RequestContext';
import { fileMatch } from '../../utils';
import { JSONCompletionItem, JSONCompletionProvider } from '../JSONCompletionProvider';

export class SchemaTranslationsCompletionProvider implements JSONCompletionProvider {
  private uriPatterns = [/(sections|blocks)\/[^\/]*\.liquid$/];

  constructor(private getDefaultSchemaTranslations: GetTranslationsForURI) {}

  async completeValue(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]> {
    if (!fileMatch(context.doc.uri, this.uriPatterns) || !isLiquidRequestContext(context)) {
      return [];
    }

    const { doc, parsed } = context;

    const label = deepGet(parsed, path);
    if (!label || typeof label !== 'string' || !label.startsWith('t:')) {
      return [];
    }

    const partial = /^t:(.*)/.exec(label)?.[1];
    if (partial === undefined) return [];

    const translations = await this.getDefaultSchemaTranslations(doc.uri);

    // We'll let the frontend do the filtering. But we'll only include shopify
    // translations if the shopify prefix is present
    const options = translationOptions(translations);

    return options.map((option): JSONCompletionItem => {
      const tLabel = `t:${option.path.join('.')}`;
      return {
        label: tLabel,
        kind: CompletionItemKind.Value,
        filterText: `"${tLabel}"`,
        insertText: `"${tLabel}"`,
        insertTextFormat: 1,
        documentation: {
          kind: 'markdown',
          value: renderTranslation(option.translation),
        },
      };
    });
  }
}
