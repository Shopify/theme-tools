import { BaseRenameProvider } from '../BaseRenameProvider';
import { DocumentManager } from '../../documents';
import {
  LiquidHtmlNode,
  LiquidVariableLookup,
  NodeTypes,
  LiquidTag,
  NamedTags,
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
import { visit } from '../../visitor';

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
    if (node.type !== NodeTypes.AssignMarkup && node.type !== NodeTypes.VariableLookup) return null;

    return {
      range: Range.create(
        textDocument.positionAt(node.position.start),
        textDocument.positionAt(node.position.end),
      ),
      placeholder: node.name || '',
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
    if (node.type !== NodeTypes.AssignMarkup && node.type !== NodeTypes.VariableLookup) return null;
    if (document.ast instanceof Error) return null;

    const oldName = node.name || '';
    const ranges: Range[] = visit(document.ast, {
      VariableLookup(node: LiquidVariableLookup): Range | undefined {
        if (node.name === oldName) {
          const range = Range.create(
            textDocument.positionAt(node.position.start),
            textDocument.positionAt(node.position.end),
          );

          return range;
        }
      },
      LiquidTag(node: LiquidTag) {
        if (node.name != NamedTags.assign) return;

        const regex = new RegExp(`\\b${oldName}\\b`);
        const assignBlockSource = node.source.slice(node.position.start, node.position.end);

        let match = regex.exec(assignBlockSource);
        if (match === null) return;

        return Range.create(
          textDocument.positionAt(match.index + node.position.start),
          textDocument.positionAt(match.index + node.position.start + oldName.length),
        );
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
