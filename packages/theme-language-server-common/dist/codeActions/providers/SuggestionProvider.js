"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestionProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const providers_1 = require("../../commands/providers");
const BaseCodeActionsProvider_1 = require("../BaseCodeActionsProvider");
const utils_1 = require("./utils");
class SuggestionProvider extends BaseCodeActionsProvider_1.BaseCodeActionsProvider {
    codeActions(params) {
        const { uri } = params.textDocument;
        const document = this.documentManager.get(uri);
        const diagnostics = this.diagnosticsManager.get(uri);
        if (!document || !diagnostics)
            return [];
        const { textDocument } = document;
        const { anomalies, version } = diagnostics;
        const start = textDocument.offsetAt(params.range.start);
        const end = textDocument.offsetAt(params.range.end);
        const suggestibleAnomalies = anomalies.filter(isSuggestible);
        const anomaliesUnderCursor = suggestibleAnomalies.filter((anomaly) => (0, utils_1.isInRange)(anomaly, start, end));
        if (anomaliesUnderCursor.length === 0)
            return [];
        return quickfixCursorActions(uri, version, anomaliesUnderCursor);
    }
}
exports.SuggestionProvider = SuggestionProvider;
SuggestionProvider.kind = vscode_languageserver_1.CodeActionKind.QuickFix;
/**
 * @returns all Offense.suggest code actions for the offenses under the cursor
 * @example Suggestion: Add the `defer` HTML attribute
 */
function quickfixCursorActions(uri, version, anomaliesUnderCursor) {
    return anomaliesUnderCursor.flatMap(({ offense, diagnostic, id }) => {
        return offense.suggest.map((suggestion, suggestionId) => (0, utils_1.toCodeAction)(`Suggestion: ${suggestion.message}`, (0, providers_1.applySuggestionCommand)(uri, version, id, suggestionId), [diagnostic], SuggestionProvider.kind));
    });
}
function isSuggestible(anomaly) {
    const { offense } = anomaly;
    return 'suggest' in offense && offense.suggest !== undefined;
}
//# sourceMappingURL=SuggestionProvider.js.map