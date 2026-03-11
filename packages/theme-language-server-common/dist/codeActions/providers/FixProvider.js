"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const commands_1 = require("../../commands");
const BaseCodeActionsProvider_1 = require("../BaseCodeActionsProvider");
const utils_1 = require("./utils");
class FixProvider extends BaseCodeActionsProvider_1.BaseCodeActionsProvider {
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
        const fixableAnomalies = anomalies.filter(utils_1.isFixable);
        const anomaliesUnderCursor = fixableAnomalies.filter((anomaly) => (0, utils_1.isInRange)(anomaly, start, end));
        if (anomaliesUnderCursor.length === 0)
            return [];
        return [
            ...quickfixCursorActions(uri, version, anomaliesUnderCursor),
            ...quickfixSameTypeActions(uri, version, anomaliesUnderCursor, fixableAnomalies),
            ...quickfixAllAction(uri, version, fixableAnomalies),
        ];
    }
}
exports.FixProvider = FixProvider;
FixProvider.kind = vscode_languageserver_1.CodeActionKind.QuickFix;
/**
 * @returns code actions to fix only one of the offenses under the cursor
 * @example Fix this ParserBlockingScript problem: '...'
 */
function quickfixCursorActions(uri, version, anomaliesUnderCursor) {
    return anomaliesUnderCursor.map(({ offense, diagnostic, id }) => {
        return (0, utils_1.toCodeAction)(`Fix this ${offense.check} problem: ${offense.message}`, (0, commands_1.applyFixCommand)(uri, version, [id]), [diagnostic], FixProvider.kind, true);
    });
}
/**
 * @returns code actions to fix all offenses of a particular type
 * @example Fix all ParserBlockingScript problems
 */
function quickfixSameTypeActions(uri, version, anomaliesUnderCursor, fixableAnomalies) {
    const checks = new Set(anomaliesUnderCursor.map((anomaly) => anomaly.offense.check));
    return Array.from(checks).flatMap((check) => {
        const checkAnomalies = fixableAnomalies.filter(({ offense }) => offense.check === check);
        // We don't want to show this one if there's only one of this type.
        if (checkAnomalies.length < 2)
            return [];
        const ids = checkAnomalies.map((a) => a.id);
        const diagnostics = checkAnomalies.map((a) => a.diagnostic);
        return (0, utils_1.toCodeAction)(`Fix all ${check} problems`, (0, commands_1.applyFixCommand)(uri, version, ids), diagnostics, FixProvider.kind);
    });
}
/**
 * @returns code action to fix all offenses of a particular type
 * @example Fix all auto-fixable problems
 */
function quickfixAllAction(uri, version, fixableAnomalies) {
    const ids = fixableAnomalies.map((a) => a.id);
    const diagnostics = fixableAnomalies.map((a) => a.diagnostic);
    const checks = new Set(diagnostics.map((a) => a.code));
    // We don't want to this one if there's only one type of problems
    if (checks.size < 2)
        return [];
    return [
        (0, utils_1.toCodeAction)(`Fix all auto-fixable problems`, (0, commands_1.applyFixCommand)(uri, version, ids), diagnostics, FixProvider.kind),
    ];
}
//# sourceMappingURL=FixProvider.js.map