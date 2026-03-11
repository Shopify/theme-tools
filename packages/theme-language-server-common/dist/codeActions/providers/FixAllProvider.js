"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixAllProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const commands_1 = require("../../commands");
const BaseCodeActionsProvider_1 = require("../BaseCodeActionsProvider");
const utils_1 = require("./utils");
/**
 * FixAllProvider is a `source.fixAll` code action provider.
 *
 * It is different from FixProvider in the sense where this won't appear on
 * top of diagnostics, but rather can be executed in different contexts.
 * Unlike FixProvider, it is also cursor position independent.
 *
 * Folks can have this run automatically on save with the following config:
 *
 * "[liquid]": {
 *   "editor.codeActionsOnSave": {
 *     "source.fixAll": true,
 *   }
 * },
 *
 * Or as as 'Right click > Source Actions...' request
 */
class FixAllProvider extends BaseCodeActionsProvider_1.BaseCodeActionsProvider {
    codeActions(params) {
        const { uri } = params.textDocument;
        const document = this.documentManager.get(uri);
        const diagnostics = this.diagnosticsManager.get(uri);
        if (!document || !diagnostics)
            return [];
        const { anomalies, version } = diagnostics;
        const fixableAnomalies = anomalies.filter(utils_1.isFixable);
        if (fixableAnomalies.length === 0)
            return [];
        return quickfixAllAction(uri, version, fixableAnomalies);
    }
}
exports.FixAllProvider = FixAllProvider;
FixAllProvider.kind = vscode_languageserver_1.CodeActionKind.SourceFixAll;
/**
 * @returns code action to fix all offenses in a file
 * @example Fix all auto-fixable problems
 */
function quickfixAllAction(uri, version, fixableAnomalies) {
    const ids = fixableAnomalies.map((a) => a.id);
    const diagnostics = fixableAnomalies.map((a) => a.diagnostic);
    return [
        (0, utils_1.toCodeAction)(`Fix all auto-fixable problems`, (0, commands_1.applyFixCommand)(uri, version, ids), diagnostics, FixAllProvider.kind),
    ];
}
//# sourceMappingURL=FixAllProvider.js.map