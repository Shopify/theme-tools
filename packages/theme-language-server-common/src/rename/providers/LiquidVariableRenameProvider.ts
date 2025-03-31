import { BaseRenameProvider } from '../BaseRenameProvider';
import { AugmentedLiquidSourceCode, DocumentManager, isLiquidSourceCode } from '../../documents';
import {
  LiquidHtmlNode,
  LiquidTagFor,
  LiquidTagTablerow,
  NamedTags,
  NodeTypes,
  Position,
  RenderMarkup,
  AssignMarkup,
  TextNode,
  LiquidVariableLookup,
  ForMarkup,
} from '@shopify/liquid-html-parser';
import { Connection, Range } from 'vscode-languageserver';
import {
  ApplyWorkspaceEditRequest,
  PrepareRenameParams,
  PrepareRenameResult,
  RenameParams,
  TextDocumentEdit,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { JSONNode, SourceCodeType, visit } from '@shopify/theme-check-common';
import { snippetName } from '../../utils/uri';
import { ClientCapabilities } from '../../ClientCapabilities';

export class LiquidVariableRenameProvider implements BaseRenameProvider {
  constructor(
    private connection: Connection,
    private clientCapabilities: ClientCapabilities,
    private documentManager: DocumentManager,
    private findThemeRootURI: (uri: string) => Promise<string>,
  ) {}

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
    const rootUri = await this.findThemeRootURI(params.textDocument.uri);
    const textDocument = document?.textDocument;

    if (!textDocument || !node || !ancestors) return null;
    if (document.ast instanceof Error) return null;
    if (!supportedTags(node, ancestors)) return null;

    const oldName = variableName(node);
    const scope = variableNameBlockScope(oldName, ancestors);
    const replaceRange = textReplaceRange(oldName, textDocument, scope);

    let liquidDocParamUpdated = false;

    const ranges: Range[] = visit(document.ast, {
      VariableLookup: replaceRange,
      AssignMarkup: replaceRange,
      ForMarkup: replaceRange,
      TextNode: (node: LiquidHtmlNode, ancestors: (LiquidHtmlNode | JSONNode)[]) => {
        if (ancestors.at(-1)?.type !== NodeTypes.LiquidDocParamNode) return;

        liquidDocParamUpdated = true;

        return replaceRange(node, ancestors);
      },
    });

    if (this.clientCapabilities.hasApplyEditSupport && liquidDocParamUpdated) {
      const themeFiles = this.documentManager.theme(rootUri, true);
      const liquidSourceCodes = themeFiles.filter(isLiquidSourceCode);
      const name = snippetName(params.textDocument.uri);

      updateRenderTags(this.connection, liquidSourceCodes, name, oldName, params.newName);
    }

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

async function updateRenderTags(
  connection: Connection,
  liquidSourceCodes: AugmentedLiquidSourceCode[],
  snippetName: string,
  oldParamName: string,
  newParamName: string,
) {
  const editLabel = `Rename snippet parameter '${oldParamName}' to '${newParamName}'`;
  const annotationId = 'renameSnippetParameter';
  const workspaceEdit: WorkspaceEdit = {
    documentChanges: [],
    changeAnnotations: {
      [annotationId]: {
        label: editLabel,
        needsConfirmation: false,
      },
    },
  };

  for (const sourceCode of liquidSourceCodes) {
    if (sourceCode.ast instanceof Error) continue;
    const textDocument = sourceCode.textDocument;
    const edits: TextEdit[] = visit<SourceCodeType.LiquidHtml, TextEdit>(sourceCode.ast, {
      RenderMarkup(node: RenderMarkup) {
        if (node.snippet.type !== NodeTypes.String || node.snippet.value !== snippetName) {
          return;
        }

        const renamedNameParamNode = node.args.find((arg) => arg.name === oldParamName);

        if (renamedNameParamNode) {
          return {
            newText: `${newParamName}: `,
            range: Range.create(
              textDocument.positionAt(renamedNameParamNode.position.start),
              textDocument.positionAt(renamedNameParamNode.value.position.start),
            ),
          };
        }

        if (node.alias?.value === oldParamName && node.variable) {
          // `as variable` is not captured in our liquid parser yet,
          // so we have to check it manually and replace it
          const aliasMatch = /as\s+([^\s,]+)/g;
          const match = aliasMatch.exec(node.source.slice(node.position.start, node.position.end));

          if (!match) return;

          return {
            newText: `as ${newParamName}`,
            range: Range.create(
              textDocument.positionAt(node.position.start + match.index),
              textDocument.positionAt(node.position.start + match.index + match[0].length),
            ),
          };
        }
      },
    });

    if (edits.length === 0) continue;
    workspaceEdit.documentChanges!.push({
      textDocument: {
        uri: textDocument.uri,
        version: sourceCode.version ?? null /* null means file from disk in this API */,
      },
      annotationId,
      edits,
    });
  }

  if (workspaceEdit.documentChanges!.length === 0) {
    console.error('Nothing to do!');
    return;
  }

  await connection.sendRequest(ApplyWorkspaceEditRequest.type, {
    label: editLabel,
    edit: workspaceEdit,
  });
}
