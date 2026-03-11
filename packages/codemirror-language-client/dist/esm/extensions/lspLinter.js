import { linter } from '@codemirror/lint';
import { Facet, StateEffect } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import { DiagnosticSeverity as LSPSeverity, PublishDiagnosticsNotification, } from 'vscode-languageserver-protocol';
import { simpleStateField } from '../utils/simpleStateField';
import { clientFacet, fileUriFacet } from './client';
import { textDocumentField } from './textDocumentSync';
class DiagnosticsPlugin {
    constructor(view) {
        const client = view.state.facet(clientFacet.reader);
        const fileUri = view.state.facet(fileUriFacet.reader);
        this.handlers = [];
        this.handlers.push(client.onNotification(PublishDiagnosticsNotification.type, (params) => {
            var _a;
            if (params.uri !== fileUri)
                return;
            view.dispatch({
                effects: [
                    setLSPDiagnosticsVersion.of((_a = params.version) !== null && _a !== void 0 ? _a : null),
                    setLSPDiagnostics.of(params.diagnostics),
                ],
            });
        }));
    }
    destroy() {
        this.handlers.forEach((disposable) => disposable.dispose());
    }
}
export const setLSPDiagnosticsVersion = StateEffect.define();
export const lspDiagnosticsVersionField = simpleStateField(setLSPDiagnosticsVersion, null);
export const setLSPDiagnostics = StateEffect.define();
export const lspDiagnosticsField = simpleStateField(setLSPDiagnostics, []);
export const diagnosticsFacet = Facet.define({
    combine: (values) => values[0],
});
export const diagnosticRendererFacet = Facet.define({
    combine: (values) => (values.length > 0 ? values[0] : undefined),
});
export const computedCodeMirrorDiagnosticsValueProvider = diagnosticsFacet.compute([textDocumentField, lspDiagnosticsField, lspDiagnosticsVersionField], (state) => {
    const doc = state.field(textDocumentField);
    const lspDiagnosticsVersion = state.field(lspDiagnosticsVersionField);
    // If the diagnostics version and doc version don't match, it means
    // the diagnostics are stale.
    if (lspDiagnosticsVersion !== doc.version) {
        return [];
    }
    const lspDiagnostics = state.field(lspDiagnosticsField);
    const diagnosticRenderer = state.facet(diagnosticRendererFacet.reader);
    return lspDiagnostics.map((diagnostic) => lspToCodeMirrorDiagnostic(diagnostic, doc, diagnosticRenderer));
});
export const diagnosticsLinter = (overrides) => linter((view) => {
    const diagnostics = view.state.facet(diagnosticsFacet.reader);
    return diagnostics;
}, {
    delay: 100,
    needsRefresh(update) {
        var _a;
        const currVersion = update.state.field(lspDiagnosticsVersionField);
        const prevVersion = update.startState.field(lspDiagnosticsVersionField);
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
export const diagnosticsPlugin = ViewPlugin.fromClass(DiagnosticsPlugin);
export const lspLinter = (linterOptions = {}) => [
    textDocumentField,
    lspDiagnosticsField,
    lspDiagnosticsVersionField,
    computedCodeMirrorDiagnosticsValueProvider,
    diagnosticsLinter(linterOptions),
    diagnosticsPlugin,
];
function lspToCodeMirrorSeverity(severity) {
    switch (severity) {
        case LSPSeverity.Error: {
            return 'error';
        }
        case LSPSeverity.Warning: {
            return 'warning';
        }
        case LSPSeverity.Hint:
        case LSPSeverity.Information:
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
//# sourceMappingURL=lspLinter.js.map