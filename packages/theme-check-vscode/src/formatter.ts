import {
  Uri,
  DiagnosticCollection,
  TextDocument,
  TextEdit,
  Diagnostic,
  Range,
  Position,
} from 'vscode';
import * as prettier from 'prettier';
import * as LiquidPrettierPlugin from '@shopify/prettier-plugin-liquid/standalone';
import { LiquidHTMLASTParsingError } from '@shopify/prettier-plugin-liquid/dist/parser/errors';

export default class LiquidFormatter {
  constructor(
    public diagnosticCollection: DiagnosticCollection,
    public diagnosticTextDocumentVersion: Map<Uri, number>,
  ) {}

  async provideDocumentFormattingEdits(
    textDocument: TextDocument,
  ): Promise<TextEdit[] | null> {
    try {
      const textEdits = [await toTextEdit(textDocument)];

      // We clear previous parsing errors if successful this time
      if (this.diagnosticCollection.has(textDocument.uri)) {
        this.diagnosticCollection.delete(textDocument.uri);
        this.diagnosticTextDocumentVersion.delete(textDocument.uri);
      }

      return textEdits;
    } catch (err: any) {
      // Present the LiquidHTMLParsingError as an error in the Problems tab
      if (
        !!err &&
        'name' in err &&
        'loc' in err &&
        err.name === 'LiquidHTMLParsingError'
      ) {
        const diagnostic = toDiagnostic(err as LiquidHTMLASTParsingError);
        if (diagnostic) {
          this.diagnosticCollection.set(textDocument.uri, [diagnostic]);
          this.diagnosticTextDocumentVersion.set(
            textDocument.uri,
            textDocument.version,
          );
        }
      }

      return null;
    }
  }
}

async function toTextEdit(textDocument: TextDocument): Promise<TextEdit> {
  const options = await prettier.resolveConfig(textDocument.uri.fsPath);
  const text = textDocument.getText();
  const formatted = prettier.format(text, {
    ...options,
    parser: 'liquid-html',
    plugins: [LiquidPrettierPlugin],
  });
  const start = textDocument.positionAt(0);
  const end = textDocument.positionAt(text.length);
  return TextEdit.replace(new Range(start, end), formatted);
}

function toDiagnostic(err: LiquidHTMLASTParsingError): Diagnostic | undefined {
  if (!err.loc) {
    return undefined;
  }
  const { start, end } = err.loc!;
  const errorMessage = err.message.split('\n')[0];
  const diagnostic = new Diagnostic(
    new Range(
      new Position(start.line - 1, start.column),
      new Position(end.line - 1, end.column),
    ),
    errorMessage,
  );
  diagnostic.source = 'prettier-plugin-liquid';
  diagnostic.code = err.name;
  return diagnostic;
}
