import { Range, TextDocument, TextEdit } from 'vscode';

export interface Format {
  (text: TextDocument): Promise<string>;
}

export default class LiquidFormatter {
  constructor(private format: Format) {}

  async provideDocumentFormattingEdits(textDocument: TextDocument): Promise<TextEdit[] | null> {
    try {
      const textEdits = [await toTextEdit(this.format, textDocument)];
      return textEdits;
    } catch (err: any) {
      // Log the errors but don't show them to the user, theme check will report the parsing errors.
      console.error(err);
      return null;
    }
  }
}

async function toTextEdit(format: Format, textDocument: TextDocument): Promise<TextEdit> {
  const formatted = await format(textDocument);
  const start = textDocument.positionAt(0);
  const end = textDocument.positionAt(textDocument.getText().length);
  return TextEdit.replace(new Range(start, end), formatted);
}
