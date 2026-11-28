import { LiquidHtmlNode, NodeTypes, toTolerantLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { findCurrentNode } from '@shopify/theme-check-common';
import { DocumentOnTypeFormattingParams, TextEdit } from 'vscode-languageserver-protocol';
import { AugmentedLiquidSourceCode } from '../../documents';
import { BaseOnTypeFormattingProvider } from '../types';

export class AngleBracketAutoclosingOnTypeFormattingProvider implements BaseOnTypeFormattingProvider {
  onTypeFormatting(
    document: AugmentedLiquidSourceCode,
    params: DocumentOnTypeFormattingParams,
  ): TextEdit[] | null {
    if (params.ch !== '<') return null;

    const { textDocument } = document;
    const offset = textDocument.offsetAt(params.position);
    if (offset === 0 || textDocument.getText().charAt(offset - 1) !== '<') return null;

    try {
      const ast =
        document.ast instanceof Error ? toTolerantLiquidHtmlAST(document.source) : document.ast;
      const [node, ancestors] = findCurrentNode(ast, offset);
      if ([node, ...ancestors].some((node) => isLiquidMarkupAt(node, offset))) return null;
    } catch {
      // Keep angle-bracket pairing if the current document cannot be parsed.
    }

    return [TextEdit.insert(params.position, '>')];
  }
}

function isLiquidMarkupAt(node: LiquidHtmlNode, offset: number): boolean {
  switch (node.type) {
    case NodeTypes.LiquidTag:
    case NodeTypes.LiquidBranch:
    case NodeTypes.LiquidRawTag:
    case NodeTypes.LiquidVariableOutput:
      // Check the markup span, rather than the Liquid node's full range, so HTML
      // inside a Liquid block still receives angle-bracket pairing.
      return node.markupPosition.start <= offset && offset <= node.markupPosition.end;
    default:
      return false;
  }
}
