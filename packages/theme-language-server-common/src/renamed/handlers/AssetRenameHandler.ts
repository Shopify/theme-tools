import { LiquidVariable, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import {
  ApplyWorkspaceEditRequest,
  Range,
  RenameFilesParams,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { AugmentedLiquidSourceCode, AugmentedSourceCode } from '../../documents';
import { assetName, isAsset } from '../../utils/uri';
import { visit } from '@shopify/theme-check-common';
import { BaseRenameHandler } from '../BaseRenameHandler';

/**
 * The AssetRenameHandler will handle asset renames.
 *
 * We'll change all the `| asset_url` that reference the old asset:
 *   {{ 'oldName.js' | asset_url }} -> {{ 'newName.js' | asset_url }}
 *
 * We'll do that for `.(css|js).liquid` files as well
 *
 * We'll do this by visiting all the liquid files in the theme and looking for
 * string | asset_url Variable nodes that reference the old asset. We'll then create a
 * WorkspaceEdit that changes the references to the new asset.
 */
export class AssetRenameHandler implements BaseRenameHandler {
  constructor(private connection: Connection, private capabilities: ClientCapabilities) {}

  async onDidRenameFiles(params: RenameFilesParams, theme: AugmentedSourceCode[]): Promise<void> {
    if (!this.capabilities.hasApplyEditSupport) return;
    const isLiquidSourceCode = (file: AugmentedSourceCode): file is AugmentedLiquidSourceCode =>
      file.type === SourceCodeType.LiquidHtml;

    const liquidSourceCodes = theme.filter(isLiquidSourceCode);
    const relevantRenames = params.files.filter(
      (file) => isAsset(file.oldUri) && isAsset(file.newUri),
    );

    const promises = relevantRenames.map(async (file) => {
      const oldAssetName = assetName(file.oldUri);
      const newAssetName = assetName(file.newUri);
      const editLabel = `Rename asset '${oldAssetName}' to '${newAssetName}'`;
      const annotationId = 'renameAsset';
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
          LiquidVariable(node: LiquidVariable) {
            if (node.filters.length === 0) return;
            if (node.expression.type !== NodeTypes.String) return;
            if (node.filters[0].name !== 'asset_url') return;
            const assetName = node.expression.value;
            if (assetName !== oldAssetName) return;
            return {
              newText: newAssetName,
              range: Range.create(
                textDocument.positionAt(node.expression.position.start + 1), // +1 to skip the opening quote
                textDocument.positionAt(node.expression.position.end - 1), // -1 to skip the closing quote
              ),
            };
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
