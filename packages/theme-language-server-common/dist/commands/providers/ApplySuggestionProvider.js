"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplySuggestionProvider = void 0;
exports.applySuggestionCommand = applySuggestionCommand;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_1 = require("vscode-languageserver");
const BaseExecuteCommandProvider_1 = require("../BaseExecuteCommandProvider");
/**
 * The ApplySuggestionProvider is responsible for handling the `themeCheck/applySuggestion` command.
 *
 * To create a command, use the `applySuggestionCommand` function.
 * The provider will execute the command with the given arguments.
 *
 * ApplySuggestionProvider collects the text edits represented by the targeted offense' `.suggest` property,
 * applies them, and forwards the result to the client using the 'workspace/applyEdit' request.
 */
class ApplySuggestionProvider extends BaseExecuteCommandProvider_1.BaseExecuteCommandProvider {
    async execute(uri, version, anomalyId, suggestionIndex) {
        var _a;
        if (!this.clientCapabilities.hasApplyEditSupport)
            return;
        const diagnostics = this.diagnosticsManager.get(uri);
        const document = this.documentManager.get(uri);
        if (!document || !diagnostics)
            return;
        if (document.version !== version || diagnostics.version !== version)
            return;
        const anomaly = diagnostics.anomalies[anomalyId];
        if (!anomaly)
            return;
        const offense = anomaly.offense;
        const suggestion = (_a = offense.suggest) === null || _a === void 0 ? void 0 : _a[suggestionIndex];
        if (!suggestion)
            return;
        // Collect text edits
        const corrector = (0, theme_check_common_1.createCorrector)(document.type, document.source);
        suggestion.fix(corrector);
        // Suggest -> TextDocumentEdit
        const { textDocument } = document;
        const textDocumentEdit = vscode_languageserver_1.TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, toTextEdits(document.textDocument, corrector.fix));
        await this.connection.sendRequest(vscode_languageserver_1.ApplyWorkspaceEditRequest.type, {
            label: `Apply suggestion: ${suggestion.message}`,
            edit: {
                documentChanges: [textDocumentEdit],
            },
        });
        // Clean up state diagnostics when we're done
        const offenses = diagnostics.anomalies.map((a) => a.offense);
        const fixedOffense = offense;
        const remainingOffenses = offenses.filter((offense) => offense !== fixedOffense);
        this.diagnosticsManager.set(uri, diagnostics.version, remainingOffenses);
    }
}
exports.ApplySuggestionProvider = ApplySuggestionProvider;
ApplySuggestionProvider.command = 'themeCheck/applySuggestion';
/**
 * applySuggestionCommand creates an LSP Command that the client can call
 */
function applySuggestionCommand(uri, version, anomalyId, suggestionIndex) {
    return vscode_languageserver_1.Command.create('applySuggestion', ApplySuggestionProvider.command, uri, version, anomalyId, suggestionIndex);
}
function toTextEdits(document, fix) {
    return (0, theme_check_common_1.flattenFixes)(fix).map((fixDesc) => toTextEdit(document, fixDesc));
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
//# sourceMappingURL=ApplySuggestionProvider.js.map