"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCodeAction = toCodeAction;
exports.isInRange = isInRange;
exports.isFixable = isFixable;
const vscode_languageserver_1 = require("vscode-languageserver");
// They have an awkard API for creating them, so we have this helper here
// to make it a bit more straightforward.
function toCodeAction(title, command, diagnostics, kind, isPreferred = false) {
    const codeAction = vscode_languageserver_1.CodeAction.create(title, command, kind);
    codeAction.diagnostics = diagnostics;
    codeAction.isPreferred = isPreferred;
    return codeAction;
}
/**
 * The range is either the selection or cursor position, an offense is in
 * range if the selection and offense overlap in any way.
 */
function isInRange({ offense }, start, end) {
    const offenseStart = offense.start.index;
    const offenseEnd = offense.end.index;
    const isOutOfRange = offenseEnd < start || offenseStart > end;
    return !isOutOfRange;
}
function isFixable(anomaly) {
    const { offense } = anomaly;
    return 'fix' in offense && offense.fix !== undefined;
}
//# sourceMappingURL=utils.js.map