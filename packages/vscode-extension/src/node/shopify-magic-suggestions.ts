import { Position, Range, TextEditor, workspace, WorkspaceEdit } from 'vscode';
import { LiquidSuggestion } from './shopify-magic';

export const conflictMarkerStart = '<<<<<<< Current';
export const conflictMarkerMiddle = '=======';
export const conflictMarkerEnd = '>>>>>>> Suggested Change';

type LiquidSuggestionWithDecorationKey = LiquidSuggestion & { key: string };

export async function applySuggestion(
  editor: TextEditor | undefined,
  { range, newCode }: LiquidSuggestionWithDecorationKey,
) {
  if (!editor) {
    return;
  }

  const endLineIndex = range.end.line - 1;
  const start = new Position(range.start.line - 1, 0);
  const end = new Position(endLineIndex, editor.document.lineAt(endLineIndex).text.length);
  const oldCode = editor.document.getText(new Range(start, end));
  const initialIndentation = oldCode.match(/^[ \t]+/)?.[0] ?? '';

  // Create a merge conflict style text
  const conflictText = [
    conflictMarkerStart,
    oldCode,
    conflictMarkerMiddle,
    newCode.replace(/^/gm, initialIndentation),
    conflictMarkerEnd,
  ].join('\n');

  // Replace the current text with the conflict markers
  const edit = new WorkspaceEdit();
  edit.replace(editor.document.uri, new Range(start, end), conflictText);
  await workspace.applyEdit(edit);
}
