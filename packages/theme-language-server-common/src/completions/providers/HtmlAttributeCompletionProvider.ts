import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import { Attribute, HtmlData, renderHtmlEntry } from '../../docset';
import { AugmentedSourceCode, DocumentManager } from '../../documents';
import {
  findLast,
  getCompoundName,
  isAttrEmpty,
  isNamedHtmlElementNode,
  isTextNode,
} from '../../utils';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, sortByName } from './common';
import { LiquidHtmlNode } from '@shopify/liquid-html-parser';

export class HtmlAttributeCompletionProvider implements Provider {
  constructor(private readonly documentManager: DocumentManager) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = findLast(ancestors, isAttrEmpty);
    const grandParentNode = findLast(ancestors, isNamedHtmlElementNode);
    const document = this.documentManager.get(params.textDocument.uri);

    if (!node || !parentNode || !grandParentNode || !document) {
      return [];
    }

    if (!isTextNode(node) || !isAttrEmpty(parentNode) || !isNamedHtmlElementNode(grandParentNode)) {
      return [];
    }

    const grandParentNodeName = getCompoundName(grandParentNode);
    const name = node.value;
    const partial = name.replace(CURSOR, '');
    const options = getOptions(partial, grandParentNodeName);

    const attributeTagRange = this.attributeTagRange(node, document);
    const hasExistingAttributeValue = this.hasExistingAttributeValue(attributeTagRange, document);
    const hasLiquidTag = this.hasLiquidTag(attributeTagRange, document);

    return options.sort(sortByName).map((tag) => {
      return toCompletionItem(tag, attributeTagRange, hasExistingAttributeValue, hasLiquidTag);
    });
  }

  hasExistingAttributeValue(attributeTagRange: Range, document: AugmentedSourceCode): boolean {
    return /^\s*=/.test(
      document.source.slice(document.textDocument.offsetAt(attributeTagRange.end)),
    );
  }

  hasLiquidTag(attributeTagRange: Range, document: AugmentedSourceCode): boolean {
    return /^(?:\{%|\{\{)/.test(
      document.source.slice(document.textDocument.offsetAt(attributeTagRange.end)),
    );
  }

  // Find the range of the attribute partial. If the attribute contains any liquid code, the range
  // will end before the first character of the liquid block.
  attributeTagRange(node: LiquidHtmlNode, document: AugmentedSourceCode): Range {
    if (node.type === 'TextNode' && node.value === CURSOR) {
      // If you try to auto-complete with no provided attribute tag,
      // we will not try to override the subsequent character.
      // E.g. <a href="" █>
      return {
        start: document.textDocument.positionAt(node.position.start),
        end: document.textDocument.positionAt(node.position.start),
      };
    }

    const sourcePartialPastCursor = document.source.slice(node.position.end);
    const attributeEndOffset =
      sourcePartialPastCursor.match(/[\s=]|\{%|\{\{|>/)?.index ?? sourcePartialPastCursor.length;

    return {
      start: document.textDocument.positionAt(node.position.start),
      end: document.textDocument.positionAt(node.position.end + attributeEndOffset),
    };
  }
}

function getOptions(partial: string, parentNodeName: string): Attribute[] {
  const tag = HtmlData.tags.find((tag) => tag.name === parentNodeName);
  const parentAttributes = tag?.attributes ?? [];
  return [...parentAttributes, ...HtmlData.globalAttributes].filter((x) =>
    x.name.startsWith(partial),
  );
}

function toCompletionItem(
  tag: Attribute,
  attributeTagRange: Range,
  hasExistingAttributeValue: boolean,
  hasLiquidTag: boolean,
): CompletionItem {
  const attributeWithValue = !tag.valueSet || tag.valueSet !== 'v';
  const insertSnippet = attributeWithValue && !hasExistingAttributeValue && !hasLiquidTag;

  return {
    label: tag.name,
    kind: CompletionItemKind.Value,
    insertTextFormat: insertSnippet ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
    textEdit: TextEdit.replace(attributeTagRange, insertSnippet ? `${tag.name}="$1"$0` : tag.name),
    documentation: {
      kind: 'markdown',
      value: renderHtmlEntry(tag),
    },
  };
}
