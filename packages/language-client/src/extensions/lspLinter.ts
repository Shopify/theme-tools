import {
  StateEffect,
  StateField,
  Extension,
  StateEffectType,
  Facet,
} from '@codemirror/state';
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
        view.dispatch({
          effects: [
            setLSPDiagnosticsVersion.of(params.version ?? null),
            setLSPDiagnostics.of(params.diagnostics),
          ],
        });
      }),
    );
  }

  destroy() {
    this.handlers.forEach((disposable) => disposable.dispose());
  }
}

export const setLSPDiagnosticsVersion = StateEffect.define<number | null>();
export const lspDiagnosticsVersionField = simpleStateField(
  setLSPDiagnosticsVersion,
  null,
);

export const setLSPDiagnostics = StateEffect.define<LSPDiagnostic[]>();
export const lspDiagnosticsField = simpleStateField(setLSPDiagnostics, []);

export const diagnosticsFacet = Facet.define<
  CodeMirrorDiagnostic[],
  CodeMirrorDiagnostic[]
>({
  combine: (values) => values[0],
});

export const computedCodeMirrorDiagnosticsValueProvider =
  diagnosticsFacet.compute(
    [textDocumentField, lspDiagnosticsField, lspDiagnosticsVersionField],
    (state) => {
      const doc = state.field(textDocumentField);
      const lspDiagnosticsVersion = state.field(lspDiagnosticsVersionField);

      // If the diagnostics version and doc version don't match, it means
      // the diagnostics are stale.
      if (lspDiagnosticsVersion !== doc.version) {
        return [];
      }

      const lspDiagnostics = state.field(lspDiagnosticsField);
      return lspDiagnostics.map((diagnostic) =>
        lspToCodeMirrorDiagnostic(diagnostic, doc),
      );
    },
  );

export const diagnosticsLinter = linter(
  (view) => {
    const diagnostics = view.state.facet(diagnosticsFacet);
    return diagnostics;
  },
  {
    delay: 100,
    needsRefresh() {
      // Not doing this caused weird issues where the diagnostics would
      // disappear because of user interaction that don't cause document
      // changes (resizing, saving file, switching focus). Trying to catch
      // all the use cases from in here doesn't make sense.
      //
      // The function is cheap to execute, so there's no need for a good
      // "needsRefresh."
      return true;
    },
  },
);
export const diagnosticsPlugin = ViewPlugin.fromClass(DiagnosticsPlugin);

export const lspLinter: Extension = [
  textDocumentField,
  lspDiagnosticsField,
  lspDiagnosticsVersionField,
  computedCodeMirrorDiagnosticsValueProvider,
  diagnosticsLinter,
  diagnosticsPlugin,
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

function simpleStateField<T>(
  stateEffect: StateEffectType<T>,
  defaultValue: T,
): StateField<T> {
  return StateField.define<T>({
    create: () => defaultValue,
    update(value, tr) {
      let updatedValue = value;

      for (const effect of tr.effects) {
        if (effect.is(stateEffect)) {
          updatedValue = effect.value;
        }
      }

      return updatedValue;
    },
  });
}
