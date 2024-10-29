import {
  getName,
  HtmlElement,
  LiquidHTMLASTParsingError,
  LiquidHtmlNode,
  NodeTypes,
  toLiquidHtmlAST,
} from '@shopify/liquid-html-parser';
import {
  DocumentOnTypeFormattingParams,
  Position,
  Range,
  TextEdit,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AugmentedLiquidSourceCode } from '../../documents';
import { findCurrentNode } from '../../visitor';
import { BaseOnTypeFormattingProvider, SetCursorPosition } from '../types';

const defer = (fn: () => void) => setTimeout(fn, 10);

/**
 * This class is responsible for closing dangling HTML elements.
 *
 * Say user types <script>, then we'd want `</script>` to be inserted.
 *
 * Thing is we want to do that only if the `</script>` isn't already present in the file.
 * If the user goes to edit `<script>` and types `>`, we don't want to insert `</script>` again.
 *
 * The "trick" we use here is to only add the `</script>` part if the
 * document.ast is an instance of LiquidHTMLASTParsingError and that the
 * unclosed element is of the correct name.
 *
 * @example:
 * ```html
 *   <div id="main">
 *     <div id="inner">|
 *   </div>
 * ```
 * - The user just finished typing `<div id="inner">` inside the div#main.
 * - This parses as though the div#inner is closed and div#main isn't.
 * - That's OK.
 * - This makes a LiquidHTMLASTParsingError with unclosed div (the div#main).
 * - Since
 *     - the cursor is at the end of a div, and
 *     - the unclosed element is a div,
 *   Then we can insert one automatically after the cursor and fix the AST.
 *
 * ```html
 *  <div id="main">
 *    <div id="inner">|</div>
 *  </div>
 * ```
 */
export class HtmlElementAutoclosingOnTypeFormattingProvider
  implements BaseOnTypeFormattingProvider
{
  constructor(private setCursorPosition: SetCursorPosition) {}

  onTypeFormatting(
    document: AugmentedLiquidSourceCode,
    params: DocumentOnTypeFormattingParams,
  ): TextEdit[] | null {
    const textDocument = document.textDocument;
    const ch = params.ch;
    // position is position of cursor so 1 ahead of char
    const { line, character } = params.position;
    switch (ch) {
      // here we fix `>` with `</$unclosed>`
      case '>': {
        const ast = document.ast;
        if (
          ast instanceof LiquidHTMLASTParsingError &&
          ast.unclosed &&
          ast.unclosed.type === NodeTypes.HtmlElement &&
          (ast.unclosed.blockStartPosition.end === textDocument.offsetAt(params.position) ||
            shouldClose(ast.unclosed, nodeAtCursor(textDocument, params.position)))
        ) {
          defer(() => this.setCursorPosition(textDocument, params.position));
          return [TextEdit.insert(Position.create(line, character), `</${ast.unclosed.name}>`)];
        } else if (!(ast instanceof Error)) {
          // Even though we accept dangling <div>s inside {% if condition %}, we prefer to auto-insert the </div>
          const [node] = findCurrentNode(ast, textDocument.offsetAt(params.position));
          if (isDanglingHtmlElement(node)) {
            defer(() => this.setCursorPosition(textDocument, params.position));
            return [TextEdit.insert(Position.create(line, character), `</${getName(node)}>`)];
          }
        }
      }
    }
    return null;
  }
}

function nodeAtCursor(textDocument: TextDocument, position: Position) {
  const text = textDocument.getText(Range.create(Position.create(0, 0), position));
  try {
    const ast = toLiquidHtmlAST(text, {
      allowUnclosedDocumentNode: true,
      mode: 'tolerant',
    });

    const [node, ancestors] = findCurrentNode(ast, textDocument.offsetAt(position));
    if (ancestors.at(-1)?.type === NodeTypes.HtmlElement) return ancestors.at(-1)!;
    if (node.type === NodeTypes.LiquidBranch) return ancestors.at(-1)!;
    return node;
  } catch {
    return null;
  }
}

function shouldClose(unclosed: any, node: LiquidHtmlNode | null) {
  if (node === null || !('blockStartPosition' in node)) return false;

  return (
    [NodeTypes.HtmlElement, NodeTypes.LiquidTag, NodeTypes.HtmlRawNode].includes(unclosed.type) &&
    getName(node) === unclosed.name
  );
}

function isDanglingHtmlElement(node: LiquidHtmlNode): node is HtmlElement {
  return (
    node !== null &&
    node.type === NodeTypes.HtmlElement &&
    node.blockEndPosition.start === node.blockEndPosition.end
  );
}
