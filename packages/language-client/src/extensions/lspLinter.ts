import { StateEffect, StateField, Extension } from '@codemirror/state';
import { PluginValue, EditorView, ViewPlugin } from '@codemirror/view';
import { linter, Diagnostic as CodeMirrorDiagnostic } from '@codemirror/lint';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  Diagnostic as LSPDiagnostic,
  Disposable,
  PublishDiagnosticsNotification,
  DiagnosticSeverity as LSPSeverity,
} from 'vscode-languageserver-protocol';

import { clientFacet, fileUriFacet } from './client';
import { textDocumentField } from './textDocumentSync';

class DiagnosticsPlugin implements PluginValue {
  private handlers: Disposable[];

  constructor(view: EditorView) {
    const client = view.state.facet(clientFacet);
    const fileUri = view.state.facet(fileUriFacet);
    this.handlers = [];
    this.handlers.push(
      client.onNotification(PublishDiagnosticsNotification.type, (params) => {
        if (params.uri !== fileUri) return;

        const textDocument = view.state.field(textDocumentField);

        // If the version of the TextDocument inside the CodeMirror state
        // does not match the version of the TextDocument for which the
        // Language Server has provided diagnostics for, then they are out
        // of date and should be discarded.
        const lspDiagnostics =
          textDocument.version === params.version ? params.diagnostics : [];

        const codeMirrorDiagnostics = lspDiagnostics.map((diagnostic) =>
          lspToCodeMirrorDiagnostic(diagnostic, textDocument),
        );

        view.dispatch({ effects: setDiagnostics.of(codeMirrorDiagnostics) });
      }),
    );
  }

  destroy() {
    this.handlers.forEach((disposable) => disposable.dispose());
  }
}

const setDiagnostics = StateEffect.define<CodeMirrorDiagnostic[]>();

const diagnosticState = StateField.define<CodeMirrorDiagnostic[]>({
  create: () => [],
  update(value, tr) {
    let updatedValue = value;

    for (const effect of tr.effects) {
      if (effect.is(setDiagnostics)) {
        updatedValue = effect.value;
      }
    }

    return updatedValue;
  },
});

export const lspLinter: Extension = [
  diagnosticState,
  ViewPlugin.fromClass(DiagnosticsPlugin),
  linter((view) => view.state.field(diagnosticState)),
];

type CodeMirrorSeverity = 'info' | 'warning' | 'error';
function lspToCodeMirrorSeverity(
  severity: LSPSeverity | undefined,
): CodeMirrorSeverity {
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
      // TODO demo magic...
      return 'error';
      return 'info';
    }
  }
}

function lspToCodeMirrorDiagnostic(
  lspDiagnostic: LSPDiagnostic,
  textDocument: TextDocument,
): CodeMirrorDiagnostic {
  const { range, message, severity } = lspDiagnostic;
  const { start, end } = range;
  return {
    from: textDocument.offsetAt(start),
    to: textDocument.offsetAt(end),
    message,
    severity: lspToCodeMirrorSeverity(severity),
  };
}
