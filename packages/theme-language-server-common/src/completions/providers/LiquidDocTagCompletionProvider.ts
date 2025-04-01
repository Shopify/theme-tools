import { NodeTypes } from '@shopify/liquid-html-parser';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { formatLiquidDocTagHandle, SUPPORTED_LIQUID_DOC_TAG_HANDLES } from '../../utils/liquidDoc';
import { filePathSupportsLiquidDoc } from '@shopify/theme-check-common';

export class LiquidDocTagCompletionProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];
    if (!filePathSupportsLiquidDoc(params.document.uri)) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.TextNode ||
      parentNode.type !== NodeTypes.LiquidRawTag ||
      parentNode.name !== 'doc' ||
      !node.value.startsWith('@')
    ) {
      return [];
    }

    // Need to offset the '@' symbol by 1
    let start = params.document.textDocument.positionAt(node.position.start + 1);
    let end = params.document.textDocument.positionAt(node.position.end);

    return Object.entries(SUPPORTED_LIQUID_DOC_TAG_HANDLES)
      .filter(([label]) => label.startsWith(node.value.slice(1)))
      .map(([label, { description, example, template }]) => ({
        label,
        kind: CompletionItemKind.EnumMember,
        documentation: {
          kind: MarkupKind.Markdown,
          value: formatLiquidDocTagHandle(label, description, example),
        },
        textEdit: TextEdit.replace(Range.create(start, end), template),
        insertTextFormat: InsertTextFormat.Snippet,
      }));
  }
}
