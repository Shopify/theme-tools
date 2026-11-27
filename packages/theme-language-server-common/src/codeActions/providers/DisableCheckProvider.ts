import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { Offense, SourceCodeType, isError } from '@shopify/theme-check-common';
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
  Diagnostic,
  TextDocumentEdit,
  TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseCodeActionsProvider } from '../BaseCodeActionsProvider';
import { isInRange } from './utils';

/**
 * Offers "Disable <Check> for this line" and "Disable <Check> for this file"
 * for the offenses under the cursor, by inserting a theme-check-disable
 * comment.
 */
export class DisableCheckProvider extends BaseCodeActionsProvider {
  static kind = CodeActionKind.QuickFix;

  codeActions(params: CodeActionParams): (Command | CodeAction)[] {
    const { uri } = params.textDocument;
    const document = this.documentManager.get(uri);
    const diagnostics = this.diagnosticsManager.get(uri);
    if (!document || !diagnostics) return [];
    if (document.type !== SourceCodeType.LiquidHtml || isError(document.ast)) return [];

    // The offense positions are only valid for the version they were computed for.
    const { textDocument, ast } = document;
    if (diagnostics.version !== textDocument.version) return [];

    const start = textDocument.offsetAt(params.range.start);
    const end = textDocument.offsetAt(params.range.end);
    const anomaliesUnderCursor = diagnostics.anomalies.filter(
      (anomaly) =>
        anomaly.offense.type === SourceCodeType.LiquidHtml && isInRange(anomaly, start, end),
    );

    // One action per check and insertion point, listing every diagnostic it silences.
    const actions = new Map<string, CodeAction>();
    const addAction = (key: string, title: string, edit: TextEdit, diagnostic: Diagnostic) => {
      const existing = actions.get(key);
      if (existing) existing.diagnostics!.push(diagnostic);
      else actions.set(key, toEditCodeAction(title, textDocument, edit, diagnostic));
    };

    for (const { offense, diagnostic } of anomaliesUnderCursor) {
      const { check } = offense;
      const lineEdit = disableNextLineEdit(textDocument, ast, offense);
      if (lineEdit) {
        const at = textDocument.offsetAt(lineEdit.range.start);
        addAction(`line:${check}:${at}`, `Disable ${check} for this line`, lineEdit, diagnostic);
      }
    }

    for (const { offense, diagnostic } of anomaliesUnderCursor) {
      const { check } = offense;
      const fileEdit = TextEdit.insert(
        textDocument.positionAt(0),
        `{% # theme-check-disable ${check} %}\n`,
      );
      addAction(`file:${check}`, `Disable ${check} for this file`, fileEdit, diagnostic);
    }

    return [...actions.values()];
  }
}

function toEditCodeAction(
  title: string,
  textDocument: TextDocument,
  edit: TextEdit,
  diagnostic: Diagnostic,
): CodeAction {
  const codeAction = CodeAction.create(
    title,
    {
      documentChanges: [
        TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, [edit]),
      ],
    },
    DisableCheckProvider.kind,
  );
  codeAction.diagnostics = [diagnostic];
  return codeAction;
}

/**
 * `theme-check-disable-next-line` disables the node that follows the comment
 * (only the opening tag of a block). This finds the innermost node whose
 * disabled range would cover the offense and inserts the comment right before
 * it: on a line of its own when the node starts its line, inline otherwise.
 *
 * Returns undefined when no such node exists, e.g. for an offense inside
 * the JSON of a {% schema %} tag.
 */
function disableNextLineEdit(
  textDocument: TextDocument,
  ast: LiquidHtmlNode,
  offense: Offense,
): TextEdit | undefined {
  const target = findDisableTarget(ast, offense);
  if (!target) return;

  const { node, inLiquidTag } = target;
  const source = textDocument.getText();
  const nodeStart = node.position.start;
  const lineStart = source.lastIndexOf('\n', nodeStart - 1) + 1;
  const beforeNode = source.slice(lineStart, nodeStart);
  const indent = beforeNode.match(/^[ \t]*/)![0];
  const startsLine = beforeNode.trim() === '';
  const position = textDocument.positionAt(nodeStart);

  if (inLiquidTag) {
    // Inside {% liquid %}, every line is a tag and comments are `# ...` lines.
    const nextLineIndent = startsLine ? indent : ' '.repeat(beforeNode.length);
    return TextEdit.insert(
      position,
      `# theme-check-disable-next-line ${offense.check}\n${nextLineIndent}`,
    );
  }

  const comment = `{% # theme-check-disable-next-line ${offense.check} %}`;
  return TextEdit.insert(position, startsLine ? `${comment}\n${indent}` : comment);
}

function findDisableTarget(
  ast: LiquidHtmlNode,
  offense: Offense,
): { node: LiquidHtmlNode; inLiquidTag: boolean } | undefined {
  const from = offense.start.index;
  const to = offense.end.index;
  let parent: LiquidHtmlNode = ast;
  let inLiquidTag = false;
  let target: { node: LiquidHtmlNode; inLiquidTag: boolean } | undefined;

  // The innermost node, so that the comment disables as little as possible:
  // before `{% liquid %}` it would disable every statement inside it.
  while (true) {
    const child = siblingNodes(parent).find(
      (node) => node.position.start <= from && to <= node.position.end,
    );
    if (!child) return target;

    const range = disabledRange(child);
    if (range.start <= from && to <= range.end) target = { node: child, inLiquidTag };

    if (child.type === NodeTypes.LiquidTag && child.name === 'liquid') inLiquidTag = true;
    parent = child;
  }
}

/** The nodes a comment can be a sibling of, as in theme-check's findNextLinePosition. */
function siblingNodes(node: LiquidHtmlNode): LiquidHtmlNode[] {
  if (node.type === NodeTypes.LiquidTag && Array.isArray(node.markup)) return node.markup;
  if ('children' in node && Array.isArray(node.children)) return node.children;
  if ('body' in node && node.body && typeof node.body === 'object' && 'nodes' in node.body) {
    return node.body.nodes as LiquidHtmlNode[];
  }
  return [];
}

/** The range `theme-check-disable-next-line` disables when it precedes this node. */
function disabledRange(node: LiquidHtmlNode) {
  if (node.type === NodeTypes.LiquidRawTag && node.name === 'doc') return node.position;
  if ('blockStartPosition' in node) return node.blockStartPosition;
  return node.position;
}
