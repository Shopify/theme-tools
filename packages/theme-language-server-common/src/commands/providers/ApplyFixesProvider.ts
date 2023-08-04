import { createCorrector, Fix, FixDescription, flattenFixes } from '@shopify/theme-check-common';
import {
  ApplyWorkspaceEditRequest,
  Command,
  TextDocumentEdit,
  TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';

/**
 * The ApplyFixesProvider is responsible for handling the `themeCheck/applyFixes` command.
 *
 * To create a command, use the `applyFixCommand` function.
 * The provider will execute the command with the given arguments.
 *
 * ApplyFixesProvider collects the text edits represented by the targeted offenses' `.fix` property,
 * applies them, and forwards the result to the client using the 'workspace/applyEdit' request.
 */
export class ApplyFixesProvider extends BaseExecuteCommandProvider {
  static command = 'themeCheck/applyFixes' as const;

  async execute(uri: string, version: number | undefined, ids: number[]) {
    if (!this.clientCapabilities.hasApplyEditSupport()) return;

    const diagnostics = this.diagnosticsManager.get(uri);
    const document = this.documentManager.get(uri);
    if (!document || !diagnostics) return;
    if (document.version !== version || diagnostics.version !== version) return;

    const anomalies = ids
      .map((id) => diagnostics.anomalies[id])
      .filter((anomaly) => !!anomaly.offense.fix);
    const fixes = anomalies.map((anomaly) => anomaly.offense.fix!);

    const corrector = createCorrector(document.type, document.source);

    for (const collectFixes of fixes) {
      collectFixes(corrector as any);
    }

    const { textDocument } = document;
    const textDocumentEdit = TextDocumentEdit.create(
      { uri: textDocument.uri, version: textDocument.version },
      toTextEdits(document.textDocument, corrector.fix),
    );

    await this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
      edit: {
        documentChanges: [textDocumentEdit],
      },
    });

    // Clean up state diagnostics when we're done
    const offenses = diagnostics.anomalies.map((a) => a.offense);
    const fixedOffenses = anomalies.map((a) => a.offense);
    const remainingOffenses = offenses.filter((offense) => !fixedOffenses.includes(offense));
    this.diagnosticsManager.set(uri, diagnostics.version, remainingOffenses);
  }
}

/**
 * applyFixCommand creates an LSP Command that the client can call
 */
export function applyFixCommand(uri: string, version: number | undefined, ids: number[]): Command {
  return Command.create('applyFixes', ApplyFixesProvider.command, uri, version, ids);
}

function toTextEdit(document: TextDocument, fixDesc: FixDescription): TextEdit {
  return {
    newText: fixDesc.insert,
    range: {
      start: document.positionAt(fixDesc.startIndex),
      end: document.positionAt(fixDesc.endIndex),
    },
  };
}

function toTextEdits(document: TextDocument, fix: Fix): TextEdit[] {
  return flattenFixes(fix).map((fixDesc) => toTextEdit(document, fixDesc));
}
