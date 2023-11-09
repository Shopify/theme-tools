import { DocumentManager } from '../documents';
import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { Range, Position, TextEdit } from 'vscode-languageserver-protocol';

export class OnTypeFormattingProvider {
  constructor(public documentManager: DocumentManager) {}

  /**
   * This very complex piece of code here exists to provide a good autoclosing UX.
   *
   * The story is kind of long so here goes...
   *
   * What we want:
   * 1. Basic autoclosing of {{, {% with the corresponding pair (and spaces)
   *   - user types: {{
   *   - user sees: {{ | }} (with cursor position at |)
   * 2. Autoclosing of {{- with -}}, {%- with -%}
   *   - user types: {{-
   *   - user sees: {{- | -}} (with cursor at |)
   * 3. User adds whitespace stripping on one side of the braces of an existing tag
   *   - user types: - at | in `{{| drop }}`
   *   - user sees: {{- drop }}
   *
   * Why we can't do it with autoclosingPairs:
   *   - VS Code's settings accepts autoclosingPairs and autocloseBefore
   *     - autoclosingPairs is a set of pairs that should be autoclosed (e.g. ['{%', '%}'])
   *     - autocloseBefore is a character set of 'allowed next characters' that would cause a closing pair
   *   - If we put a space (' ') the autoclosingPairs set, then (3) from above becomes funky:
   *     - assume autoclosingPairs = {|}, {{|}}, {{ | }}
   *     - user types: a space at | in `{{| drop }}`
   *     - user sees: {{   }}drop }}
   *   - This happens because the space is an autocloseBefore character, it sees a space after the cursor
   *     so it closes '{{ ' with ' }}' at the cursor position, resulting in '{{  }}drop }}'
   *   - Something similar happens if we include the `-` in the autoclosing pairs
   *   - This is annoying!
   *
   * So our solution is the following:
   * 1. We change the pairs to include the closing space (this way our cursor remains where we want it to be)
   *    - {{| }}
   *    - {%| %}
   * 2. We add this OnTypeFormattingProvider that does the following "fixes":
   *    - {{| }}   into {{ | }}
   *    - {{ -| }} into {{- | -}}
   *    - {%| %}   into {% | %}
   *    - {% -| %} into {%- | -%}
   *
   * This lets us avoid the unnecessary close and accomplish 1, 2 and 3 :)
   *
   * Fallback for editor.onTypeFormatting: false is to let the user type the `-` on both sides manually
   */
  async onTypeFormatting(params: DocumentOnTypeFormattingParams) {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document) return null;
    const textDocument = document.textDocument;
    const ch = params.ch;
    // position is position of cursor so 1 ahead of char
    const { line, character } = params.position;
    // This is an early return to avoid doing currentLine.at(-1);
    if ((ch === ' ' && character <= 2) || character <= 1) return null;
    const currentLineRange = Range.create(Position.create(line, 0), Position.create(line + 1, 0));
    const currentLine = textDocument.getText(currentLineRange);
    const charIdx = ch === ' ' ? character - 2 : character - 1;
    const char = currentLine.at(charIdx);
    switch (char) {
      // here we fix {{| }} with {{ | }}
      // here we fix {%| %} with {% | %}
      case '{':
      case '%': {
        const chars = currentLine.slice(charIdx - 1, charIdx + 4);
        if (chars === '{{ }}' || chars === '{% %}') {
          return [TextEdit.insert(Position.create(line, charIdx + 1), ' ')];
        }
      }

      // here we fix {{ -| }} to {{- | -}}
      // here we fix {% -| }} to {%- | -%}
      case '-': {
        // remember 0-index means 4th char
        if (charIdx < 3) return null;

        const chars = currentLine.slice(charIdx - 3, charIdx + 4);
        if (chars === '{{ - }}' || chars === '{% - %}') {
          // Here we're being clever and doing the {{- -}} if the first character
          // you type is a `-`, leaving your cursor in the middle :)
          return [
            // Start with
            //   {{ - }}
            //     ^ start replace
            //       ^ end replace (excluded)
            // Replace with '- ', get
            //   {{- }}
            TextEdit.replace(
              Range.create(Position.create(line, charIdx - 1), Position.create(line, charIdx + 1)),
              '- ',
            ),
            // Start with
            //   {{ - }}
            //      ^ char
            //        ^ insertion point
            // Insert ' ' , get
            //   {{ - -}}
            // Both together and you get {{- -}} with your cursor in the middle
            TextEdit.insert(Position.create(line, charIdx + 2), '-'),
          ];
        }
      }
    }
    return null;
  }
}
