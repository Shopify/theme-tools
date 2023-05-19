import {
  createCorrector,
  Fix,
  FixDescription,
  flattenFixes,
} from '@shopify/theme-check-common';
import {
  AnnotatedTextEdit,
  ApplyWorkspaceEditRequest,
  ChangeAnnotation,
  ChangeAnnotationIdentifier,
  Command,
  TextDocumentEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { BaseExecuteCommandProvider } from '../BaseExecuteCommandProvider';

/**
 * The ApplySuggestionProvider is responsible for handling the `themeCheck/applySuggestion` command.
 *
 * To create a command, use the `applySuggestionCommand` function.
 * The provider will execute the command with the given arguments.
 *
 * ApplySuggestionProvider collects the text edits represented by the targeted offense' `.suggest` property,
 * applies them, and forwards the result to the client using the 'workspace/applyEdit' request.
 *
 * Since suggestions are deemed unsafe, they are annotated and sent with needsConfirmation.
 */
export class ApplySuggestionProvider extends BaseExecuteCommandProvider {
  static command = 'themeCheck/applySuggestion' as const;

  async execute(
    uri: string,
    version: number | undefined,
    anomalyId: number,
    suggestionIndex: number,
  ) {
    const diagnostics = this.diagnosticsManager.get(uri);
    const document = this.documentManager.get(uri);
    if (!document || !diagnostics || diagnostics.version !== version) return;

    const anomaly = diagnostics.anomalies[anomalyId];
    if (!anomaly) return;
    const offense = anomaly.offense;
    const suggestion = offense.suggest?.[suggestionIndex];
    if (!suggestion) return;

    // Collect text edits
    const corrector = createCorrector(document.type, document.source);
    suggestion.fix(corrector as any);

    // Create an annotation so that they are named in the Undo tree.
    const annotationId: ChangeAnnotationIdentifier = `${offense.check}.${anomalyId}.${suggestionIndex}`;
    const label = `Apply suggestion: ${suggestion.message}`;
    const needsConfirmation = true;
    const annotation = ChangeAnnotation.create(label, needsConfirmation);

    // Suggest -> TextDocumentEdit
    const { textDocument } = document;
    const textDocumentEdit = TextDocumentEdit.create(
      { uri: textDocument.uri, version: textDocument.version },
      toAnnotatedTextEdits(document.textDocument, annotationId, corrector.fix),
    );

    await this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
      label,
      edit: {
        documentChanges: [textDocumentEdit],
        changeAnnotations: {
          [annotationId]: annotation,
        },
      },
    });

    // Clean up state diagnostics when we're done
    const offenses = diagnostics.anomalies.map((a) => a.offense);
    const fixedOffense = anomaly.offense;
    const remainingOffenses = offenses.filter(
      (offense) => offense !== fixedOffense,
    );
    this.diagnosticsManager.set(uri, diagnostics.version, remainingOffenses);
  }
}

/**
 * applySuggestionCommand creates an LSP Command that the client can call
 */
export function applySuggestionCommand(
  uri: string,
  version: number | undefined,
  anomalyId: number,
  suggestionIndex: number,
): Command {
  return Command.create(
    'applySuggestion',
    ApplySuggestionProvider.command,
    uri,
    version,
    anomalyId,
    suggestionIndex,
  );
}

function toTextEdit(
  document: TextDocument,
  annotationId: ChangeAnnotationIdentifier,
  fixDesc: FixDescription,
): AnnotatedTextEdit {
  return {
    annotationId,
    newText: fixDesc.insert,
    range: {
      start: document.positionAt(fixDesc.startIndex),
      end: document.positionAt(fixDesc.endIndex),
    },
  };
}

function toAnnotatedTextEdits(
  document: TextDocument,
  annotationId: ChangeAnnotationIdentifier,
  fix: Fix,
): AnnotatedTextEdit[] {
  return flattenFixes(fix).map((fixDesc) =>
    toTextEdit(document, annotationId, fixDesc),
  );
}
