"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offenseToDiagnostic = offenseToDiagnostic;
exports.offenseSeverity = offenseSeverity;
const vscode_languageserver_1 = require("vscode-languageserver");
const theme_check_common_1 = require("@shopify/theme-check-common");
const checkToDocsUrl = theme_check_common_1.allChecks.reduce((acc, checkDescription) => {
    const url = checkDescription.meta.docs.url;
    const code = checkDescription.meta.code;
    if (url !== undefined) {
        acc[code] = url;
    }
    return acc;
}, {});
function offenseToDiagnostic(offense) {
    const diagnostic = vscode_languageserver_1.Diagnostic.create(diagnosticRange(offense), offense.message, diagnosticSeverity(offense), offense.check, 'theme-check');
    const url = checkToDocsUrl[offense.check];
    if (url) {
        diagnostic.codeDescription = { href: url };
    }
    return diagnostic;
}
function diagnosticRange({ start, end }) {
    return {
        start: {
            line: start.line,
            character: start.character,
        },
        end: {
            line: end.line,
            character: end.character,
        },
    };
}
function diagnosticSeverity(offense) {
    switch (offense.severity) {
        case theme_check_common_1.Severity.INFO: {
            return vscode_languageserver_1.DiagnosticSeverity.Information;
        }
        case theme_check_common_1.Severity.WARNING: {
            return vscode_languageserver_1.DiagnosticSeverity.Warning;
        }
        case theme_check_common_1.Severity.ERROR: {
            return vscode_languageserver_1.DiagnosticSeverity.Error;
        }
        default: {
            return (0, theme_check_common_1.assertNever)(offense.severity);
        }
    }
}
function offenseSeverity(diagnostic) {
    switch (diagnostic.severity) {
        case vscode_languageserver_1.DiagnosticSeverity.Hint:
        case vscode_languageserver_1.DiagnosticSeverity.Information: {
            return theme_check_common_1.Severity.INFO;
        }
        case vscode_languageserver_1.DiagnosticSeverity.Warning: {
            return theme_check_common_1.Severity.WARNING;
        }
        case vscode_languageserver_1.DiagnosticSeverity.Error: {
            return theme_check_common_1.Severity.ERROR;
        }
        default: {
            return theme_check_common_1.Severity.INFO;
        }
    }
}
//# sourceMappingURL=offenseToDiagnostic.js.map