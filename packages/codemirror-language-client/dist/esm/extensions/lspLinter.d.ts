import { Diagnostic as CodeMirrorDiagnostic, linter } from '@codemirror/lint';
import { Extension, Facet } from '@codemirror/state';
import { EditorView, PluginValue, ViewPlugin } from '@codemirror/view';
import { Diagnostic as LSPDiagnostic } from 'vscode-languageserver-protocol';
declare class DiagnosticsPlugin implements PluginValue {
    private handlers;
    constructor(view: EditorView);
    destroy(): void;
}
export declare const setLSPDiagnosticsVersion: import("@codemirror/state").StateEffectType<number | null>;
export declare const lspDiagnosticsVersionField: import("@codemirror/state").StateField<number | null>;
export declare const setLSPDiagnostics: import("@codemirror/state").StateEffectType<LSPDiagnostic[]>;
export declare const lspDiagnosticsField: import("@codemirror/state").StateField<LSPDiagnostic[]>;
export declare const diagnosticsFacet: Facet<CodeMirrorDiagnostic[], CodeMirrorDiagnostic[]>;
export type DiagnosticRenderer = (lspDiagnostic: LSPDiagnostic) => Node;
export declare const diagnosticRendererFacet: Facet<DiagnosticRenderer | undefined, DiagnosticRenderer | undefined>;
export declare const computedCodeMirrorDiagnosticsValueProvider: Extension;
type SecondArgType<F> = F extends (_: any, second: infer A) => any ? A : never;
export type LinterOptions = SecondArgType<typeof linter>;
export declare const diagnosticsLinter: (overrides: LinterOptions) => Extension;
export declare const diagnosticsPlugin: ViewPlugin<DiagnosticsPlugin>;
export declare const lspLinter: (linterOptions?: LinterOptions) => Extension;
export {};
