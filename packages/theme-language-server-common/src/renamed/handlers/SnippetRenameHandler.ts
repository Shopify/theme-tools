import { LiquidTag, NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import {
  ApplyWorkspaceEditRequest,
  Range,
  RenameFilesParams,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { AugmentedLiquidSourceCode, AugmentedSourceCode } from '../../documents';
import { isSnippet, snippetName } from '../../utils/uri';
import { visit } from '../../visitor';
import { BaseRenameHandler } from '../BaseRenameHandler';

/**
 * The SnippetRenameHandler will handle snippet renames.
 *
 * We'll change all the render and include tags that reference the old snippet
 * to reference the new snippet.
 *
 *   {% render 'oldName' %} -> {% render 'newName' %}
 *
 * We'll do this by visiting all the liquid files in the theme and looking for
 * render and include tags that reference the old snippet. We'll then create a
 * WorkspaceEdit that changes the references to the new snippet.
 */
export class SnippetRenameHandler implements BaseRenameHandler {
  constructor(private connection: Connection) {}

  async onDidRenameFiles(params: RenameFilesParams, theme: AugmentedSourceCode[]): Promise<void> {
    const isLiquidSourceCode = (file: AugmentedSourceCode): file is AugmentedLiquidSourceCode =>
      file.type === SourceCodeType.LiquidHtml;

    const liquidSourceCodes = theme.filter(isLiquidSourceCode);
    const relevantRenames = params.files.filter(
      (file) => isSnippet(file.oldUri) && isSnippet(file.newUri),
    );

    const promises = relevantRenames.map(async (file) => {
      const oldSnippetName = snippetName(file.oldUri);
      const newSnippetName = snippetName(file.newUri);
      const editLabel = `Rename snippet '${oldSnippetName}' to '${newSnippetName}'`;
      const annotationId = 'renameSnippet';
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
          LiquidTag(node: LiquidTag) {
            if (node.name !== NamedTags.render && node.name !== NamedTags.include) {
              return;
            }
            if (typeof node.markup === 'string') {
              return;
            }
            const snippet = node.markup.snippet;
            if (snippet.type === NodeTypes.String && snippet.value === oldSnippetName) {
              return {
                newText: `${newSnippetName}`,
                range: Range.create(
                  textDocument.positionAt(snippet.position.start + 1), // +1 to skip the opening quote
                  textDocument.positionAt(snippet.position.end - 1), // -1 to skip the closing quote
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

      return this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
        label: editLabel,
        edit: workspaceEdit,
      });
    });

    await Promise.all(promises);
  }
}
