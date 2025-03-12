import { TextDocument, Position } from 'vscode-languageserver-textdocument';

export function offsetToPosition(source: TextDocument, offset: number): Position {
  const text = source.getText();
  const textUpToOffset = text.slice(0, offset);

  // Count the number of newlines to determine the line number
  const line = textUpToOffset.split('\n').length - 1;

  // Find the start of the current line
  const lastNewlineIndex = textUpToOffset.lastIndexOf('\n');

  // If there's no newline, we're on the first line, so character is just the offset
  // Otherwise, character is the offset minus the position of the last newline minus 1
  const character = lastNewlineIndex === -1 ? offset : offset - lastNewlineIndex - 1;

  return { line, character };
}

export function positionToOffset(source: TextDocument, position: Position): number {
  const text = source.getText();
  const lines = text.split('\n');

  // Sum the lengths of all previous lines (plus newline characters)
  let offset = 0;
  for (let i = 0; i < position.line; i++) {
    offset += lines[i].length + 1; // +1 for the newline character
  }

  // Add the character offset in the current line
  offset += position.character;

  return offset;
}
