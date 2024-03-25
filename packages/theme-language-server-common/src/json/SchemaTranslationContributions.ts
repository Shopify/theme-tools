import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode, SourceCodeType, isError, parseJSON } from '@shopify/theme-check-common';
import {
  CompletionsCollector,
  JSONPath,
  JSONWorkerContribution,
} from 'vscode-json-languageservice';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-protocol';
import { DocumentManager } from '../documents';
import {
  GetTranslationsForURI,
  renderTranslation,
  translationOptions,
  translationValue,
} from '../translations';
import { Visitor, visit } from '../visitor';
import { uriMatch } from './fileMatch';

/**
 * This contribution is responsible for providing completions and hover of
 * `t:` translations in sections and blocks {% schema %} JSON blobs.
 */
export class SchemaTranslationContributions implements JSONWorkerContribution {
  private uriPatterns = [/^.*\/(sections|blocks)\/[^\/]*\.liquid$/];

  constructor(
    private documentManager: DocumentManager,
    private getDefaultSchemaTranslations: GetTranslationsForURI,
  ) {}

  /**
   * Because the API for JSONWorkerContribution is slightly weird, we need to
   * return undefined (not Promise<undefined>) for this contribution to be
   * skipped and fallbacks to go through. It's not typed properly either.
   */
  getInfoContribution(uri: string, location: JSONPath): Promise<string[]> {
    if (!uriMatch(uri, this.uriPatterns)) return undefined as any;
    const doc = this.documentManager.get(uri);
    if (
      !doc ||
      location.length === 0 ||
      doc.ast instanceof Error ||
      doc.type !== SourceCodeType.LiquidHtml
    ) {
      return undefined as any;
    }

    const schema = findSchemaNode(doc.ast);
    if (!schema) return undefined as any;

    const jsonString = schema.source.slice(
      schema.blockStartPosition.end,
      schema.blockEndPosition.start,
    );
    const jsonDocument = parseJSON(jsonString);
    if (isError(jsonDocument)) return undefined as any;

    const label = location.reduce((acc: any, val: any) => acc?.[val], jsonDocument);
    if (!label || typeof label !== 'string' || !label.startsWith('t:')) return undefined as any;

    return this.getDefaultSchemaTranslations(uri).then((translations) => {
      const path = label.slice(2);
      const value = translationValue(path, translations);
      if (!value) return undefined as any;

      return [renderTranslation(value)];
    });
  }

  async collectValueCompletions(
    uri: string,
    location: JSONPath,
    propertyKey: string,
    result: CompletionsCollector,
  ) {
    if (!uriMatch(uri, this.uriPatterns)) return;
    const doc = this.documentManager.get(uri);
    if (!doc || doc.ast instanceof Error || doc.type !== SourceCodeType.LiquidHtml) {
      return;
    }

    const schema = findSchemaNode(doc.ast);
    if (!schema) return;

    const jsonString = schema.source.slice(
      schema.blockStartPosition.end,
      schema.blockEndPosition.start,
    );
    const jsonDocument = parseJSON(jsonString);
    if (!jsonDocument) return;

    const label = location
      .concat(propertyKey)
      .reduce((acc: any, val: any) => acc?.[val], jsonDocument);
    if (!label || typeof label !== 'string' || !label.startsWith('t:')) {
      return;
    }

    const items = await this.recommendTranslations(uri, label);
    for (const item of items) {
      result.add(item);
    }
  }

  // These are only there to satisfy the TS interface
  async collectDefaultCompletions(_uri: string, _result: CompletionsCollector) {}
  // prettier-ignore
  async collectPropertyCompletions(_uri: string, _location: JSONPath, _currentWord: string, _addValue: boolean, _isLast: boolean, _result: CompletionsCollector) {}

  private async recommendTranslations(
    uri: string,
    label: string,
  ): Promise<(CompletionItem & { insertText: string })[]> {
    const partial = /^t:(.*)/.exec(label)?.[1];
    if (!partial && partial !== '') return [];

    const translations = await this.getDefaultSchemaTranslations(uri);

    // We'll let the frontend do the filtering. But we'll only include shopify
    // translations if the shopify prefix is present
    const options = translationOptions(translations);

    return options.map((option): CompletionItem & { insertText: string } => {
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

export function findSchemaNode(ast: LiquidHtmlNode) {
  const nodes = visit(ast, {
    LiquidRawTag(node) {
      if (node.name === 'schema') {
        return node;
      }
    },
  } as Visitor<SourceCodeType.LiquidHtml, LiquidRawTag>);

  return nodes[0];
}
