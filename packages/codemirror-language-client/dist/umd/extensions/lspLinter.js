(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "@codemirror/lint", "@codemirror/state", "@codemirror/view", "vscode-languageserver-protocol", "../utils/simpleStateField", "./client", "./textDocumentSync"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lspLinter = exports.diagnosticsPlugin = exports.diagnosticsLinter = exports.computedCodeMirrorDiagnosticsValueProvider = exports.diagnosticRendererFacet = exports.diagnosticsFacet = exports.lspDiagnosticsField = exports.setLSPDiagnostics = exports.lspDiagnosticsVersionField = exports.setLSPDiagnosticsVersion = void 0;
    const lint_1 = require("@codemirror/lint");
    const state_1 = require("@codemirror/state");
    const view_1 = require("@codemirror/view");
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const simpleStateField_1 = require("../utils/simpleStateField");
    const client_1 = require("./client");
    const textDocumentSync_1 = require("./textDocumentSync");
    class DiagnosticsPlugin {
        constructor(view) {
            const client = view.state.facet(client_1.clientFacet.reader);
            const fileUri = view.state.facet(client_1.fileUriFacet.reader);
            this.handlers = [];
            this.handlers.push(client.onNotification(vscode_languageserver_protocol_1.PublishDiagnosticsNotification.type, (params) => {
                var _a;
                if (params.uri !== fileUri)
                    return;
                view.dispatch({
                    effects: [
                        exports.setLSPDiagnosticsVersion.of((_a = params.version) !== null && _a !== void 0 ? _a : null),
                        exports.setLSPDiagnostics.of(params.diagnostics),
                    ],
                });
            }));
        }
        destroy() {
            this.handlers.forEach((disposable) => disposable.dispose());
        }
    }
    exports.setLSPDiagnosticsVersion = state_1.StateEffect.define();
    exports.lspDiagnosticsVersionField = (0, simpleStateField_1.simpleStateField)(exports.setLSPDiagnosticsVersion, null);
    exports.setLSPDiagnostics = state_1.StateEffect.define();
    exports.lspDiagnosticsField = (0, simpleStateField_1.simpleStateField)(exports.setLSPDiagnostics, []);
    exports.diagnosticsFacet = state_1.Facet.define({
        combine: (values) => values[0],
    });
    exports.diagnosticRendererFacet = state_1.Facet.define({
        combine: (values) => (values.length > 0 ? values[0] : undefined),
    });
    exports.computedCodeMirrorDiagnosticsValueProvider = exports.diagnosticsFacet.compute([textDocumentSync_1.textDocumentField, exports.lspDiagnosticsField, exports.lspDiagnosticsVersionField], (state) => {
        const doc = state.field(textDocumentSync_1.textDocumentField);
        const lspDiagnosticsVersion = state.field(exports.lspDiagnosticsVersionField);
        // If the diagnostics version and doc version don't match, it means
        // the diagnostics are stale.
        if (lspDiagnosticsVersion !== doc.version) {
            return [];
        }
        const lspDiagnostics = state.field(exports.lspDiagnosticsField);
        const diagnosticRenderer = state.facet(exports.diagnosticRendererFacet.reader);
        return lspDiagnostics.map((diagnostic) => lspToCodeMirrorDiagnostic(diagnostic, doc, diagnosticRenderer));
    });
    const diagnosticsLinter = (overrides) => (0, lint_1.linter)((view) => {
        const diagnostics = view.state.facet(exports.diagnosticsFacet.reader);
        return diagnostics;
    }, {
        delay: 100,
        needsRefresh(update) {
            var _a;
            const currVersion = update.state.field(exports.lspDiagnosticsVersionField);
            const prevVersion = update.startState.field(exports.lspDiagnosticsVersionField);
            // Checking against any kind of changes otherwise the squiggly line disappears!!
            return (update.geometryChanged ||
                update.viewportChanged ||
                update.heightChanged ||
                update.focusChanged ||
                update.docChanged ||
                ((_a = update.transactions[0]) === null || _a === void 0 ? void 0 : _a.reconfigured) ||
                prevVersion !== currVersion);
        },
        ...overrides,
    });
    exports.diagnosticsLinter = diagnosticsLinter;
    exports.diagnosticsPlugin = view_1.ViewPlugin.fromClass(DiagnosticsPlugin);
    const lspLinter = (linterOptions = {}) => [
        textDocumentSync_1.textDocumentField,
        exports.lspDiagnosticsField,
        exports.lspDiagnosticsVersionField,
        exports.computedCodeMirrorDiagnosticsValueProvider,
        (0, exports.diagnosticsLinter)(linterOptions),
        exports.diagnosticsPlugin,
    ];
    exports.lspLinter = lspLinter;
    function lspToCodeMirrorSeverity(severity) {
        switch (severity) {
            case vscode_languageserver_protocol_1.DiagnosticSeverity.Error: {
                return 'error';
            }
            case vscode_languageserver_protocol_1.DiagnosticSeverity.Warning: {
                return 'warning';
            }
            case vscode_languageserver_protocol_1.DiagnosticSeverity.Hint:
            case vscode_languageserver_protocol_1.DiagnosticSeverity.Information:
            default: {
                return 'info';
            }
        }
    }
    function lspToCodeMirrorDiagnostic(lspDiagnostic, textDocument, diagnosticRenderer) {
        const { range, message, severity } = lspDiagnostic;
        const { start, end } = range;
        return {
            from: textDocument.offsetAt(start),
            to: textDocument.offsetAt(end),
            message,
            severity: lspToCodeMirrorSeverity(severity),
            renderMessage: diagnosticRenderer ? () => diagnosticRenderer(lspDiagnostic) : undefined,
        };
    }
});
//# sourceMappingURL=lspLinter.js.map