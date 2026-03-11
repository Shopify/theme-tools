"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyFixesProvider = void 0;
exports.applyFixCommand = applyFixCommand;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_1 = require("vscode-languageserver");
const BaseExecuteCommandProvider_1 = require("../BaseExecuteCommandProvider");
/**
 * The ApplyFixesProvider is responsible for handling the `themeCheck/applyFixes` command.
 *
 * To create a command, use the `applyFixCommand` function.
 * The provider will execute the command with the given arguments.
 *
 * ApplyFixesProvider collects the text edits represented by the targeted offenses' `.fix` property,
 * applies them, and forwards the result to the client using the 'workspace/applyEdit' request.
 */
class ApplyFixesProvider extends BaseExecuteCommandProvider_1.BaseExecuteCommandProvider {
    async execute(uri, version, ids) {
        if (!this.clientCapabilities.hasApplyEditSupport)
            return;
        const diagnostics = this.diagnosticsManager.get(uri);
        const document = this.documentManager.get(uri);
        if (!document || !diagnostics)
            return;
        if (document.version !== version || diagnostics.version !== version)
            return;
        const anomalies = ids
            .map((id) => diagnostics.anomalies[id])
            .filter((anomaly) => !!anomaly.offense.fix);
        const fixes = anomalies.map((anomaly) => anomaly.offense.fix);
        const corrector = (0, theme_check_common_1.createCorrector)(document.type, document.source);
        for (const collectFixes of fixes) {
            collectFixes(corrector);
        }
        const { textDocument } = document;
        const textDocumentEdit = vscode_languageserver_1.TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, toTextEdits(document.textDocument, corrector.fix));
        await this.connection.sendRequest(vscode_languageserver_1.ApplyWorkspaceEditRequest.type, {
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
exports.ApplyFixesProvider = ApplyFixesProvider;
ApplyFixesProvider.command = 'themeCheck/applyFixes';
/**
 * applyFixCommand creates an LSP Command that the client can call
 */
function applyFixCommand(uri, version, ids) {
    return vscode_languageserver_1.Command.create('applyFixes', ApplyFixesProvider.command, uri, version, ids);
}
function toTextEdit(document, fixDesc) {
    return {
        newText: fixDesc.insert,
        range: {
            start: document.positionAt(fixDesc.startIndex),
            end: document.positionAt(fixDesc.endIndex),
        },
    };
}
function toTextEdits(document, fix) {
    return (0, theme_check_common_1.flattenFixes)(fix).map((fixDesc) => toTextEdit(document, fixDesc));
}
//# sourceMappingURL=ApplyFixesProvider.js.map