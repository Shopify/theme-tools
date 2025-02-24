import { BaseRenameProvider } from '../BaseRenameProvider';
import { DocumentManager } from '../../documents';
import {
  LiquidHtmlNode,
  LiquidTagFor,
  LiquidTagTablerow,
  NamedTags,
  NodeTypes,
  Position,
  AssignMarkup,
  TextNode,
  LiquidVariableLookup,
  ForMarkup,
} from '@shopify/liquid-html-parser';
import { Range } from 'vscode-languageserver';
import {
  PrepareRenameParams,
  PrepareRenameResult,
  RenameParams,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { visit } from '@shopify/theme-check-common';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { JSONNode } from '@shopify/theme-check-common';

export class LiquidVariableRenameProvider implements BaseRenameProvider {
  constructor(private documentManager: DocumentManager) {}

  async prepare(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: PrepareRenameParams,
  ): Promise<null | PrepareRenameResult> {
    const document = this.documentManager.get(params.textDocument.uri);
    const textDocument = document?.textDocument;

    if (!textDocument || !node || !ancestors) return null;
    if (!supportedTags(node, ancestors)) return null;

    const oldName = variableName(node);
    const offsetOfVariableNameEnd = node.position.start + oldName.length;

    // The cursor could be past the end of the variable name
    if (textDocument.offsetAt(params.position) > offsetOfVariableNameEnd) return null;

    return {
      range: Range.create(
        textDocument.positionAt(node.position.start),
        textDocument.positionAt(offsetOfVariableNameEnd),
      ),
      placeholder: oldName,
    };
  }

  async rename(
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: RenameParams,
  ): Promise<null | WorkspaceEdit> {
    const document = this.documentManager.get(params.textDocument.uri);
    const textDocument = document?.textDocument;

    if (!textDocument || !node || !ancestors) return null;
    if (document.ast instanceof Error) return null;
    if (!supportedTags(node, ancestors)) return null;

    const oldName = variableName(node);
    const scope = variableNameBlockScope(oldName, ancestors);
    const replaceRange = textReplaceRange(oldName, textDocument, scope);

    const ranges: Range[] = visit(document.ast, {
      VariableLookup: replaceRange,
      AssignMarkup: replaceRange,
      ForMarkup: replaceRange,
      TextNode: (node: LiquidHtmlNode, ancestors: (LiquidHtmlNode | JSONNode)[]) => {
        if (ancestors.at(-1)?.type !== NodeTypes.LiquidDocParamNode) return;

        return replaceRange(node, ancestors);
      },
    });

    const textDocumentEdit = TextDocumentEdit.create(
      { uri: textDocument.uri, version: textDocument.version },
      ranges.map((range) => TextEdit.replace(range, params.newName)),
    );

    return {
      documentChanges: [textDocumentEdit],
    };
  }
}

function supportedTags(
  node: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[],
): node is AssignMarkup | LiquidVariableLookup | ForMarkup | TextNode {
  return (
    node.type === NodeTypes.AssignMarkup ||
    node.type === NodeTypes.VariableLookup ||
    node.type === NodeTypes.ForMarkup ||
    isLiquidDocParamNameNode(node, ancestors)
  );
}

function isLiquidDocParamNameNode(
  node: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[],
): node is TextNode {
  const parentNode = ancestors.at(-1);

  return (
    !!parentNode &&
    parentNode.type === NodeTypes.LiquidDocParamNode &&
    parentNode.paramName === node &&
    node.type === NodeTypes.TextNode
  );
}

function variableName(node: LiquidHtmlNode): string {
  switch (node.type) {
    case NodeTypes.VariableLookup:
    case NodeTypes.AssignMarkup:
      return node.name ?? '';
    case NodeTypes.ForMarkup:
      return node.variableName ?? '';
    case NodeTypes.TextNode:
      return node.value;
    default:
      return '';
  }
}

/*
 * Find the scope where the variable name is used. Looks at defined in `tablerow` and `for` tags.
 */
function variableNameBlockScope(
  variableName: string,
  ancestors: (LiquidHtmlNode | JSONNode)[],
): Position | undefined {
  let scopedAncestor: LiquidTagTablerow | LiquidTagFor | undefined;

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (
      ancestor.type === NodeTypes.LiquidTag &&
      (ancestor.name === NamedTags.tablerow || ancestor.name === NamedTags.for) &&
      typeof ancestor.markup !== 'string' &&
      ancestor.markup.variableName === variableName
    ) {
      scopedAncestor = ancestor as LiquidTagTablerow | LiquidTagFor;
      break;
    }
  }

  if (!scopedAncestor || !scopedAncestor.blockEndPosition) return;

  return {
    start: scopedAncestor.blockStartPosition.start,
    end: scopedAncestor.blockEndPosition.end,
  };
}

function textReplaceRange(
  oldName: string,
  textDocument: TextDocument,
  selectedVariableScope?: Position,
) {
  return (node: LiquidHtmlNode, ancestors: (LiquidHtmlNode | JSONNode)[]) => {
    if (variableName(node) !== oldName) return;

    const ancestorScope = variableNameBlockScope(oldName, ancestors);
    if (
      ancestorScope?.start !== selectedVariableScope?.start ||
      ancestorScope?.end !== selectedVariableScope?.end
    ) {
      return;
    }

    return Range.create(
      textDocument.positionAt(node.position.start),
      textDocument.positionAt(node.position.start + oldName.length),
    );
  };
}
