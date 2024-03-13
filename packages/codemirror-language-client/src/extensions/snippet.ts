import { MapMode, RangeSet, RangeValue, StateEffect, StateField, Range } from '@codemirror/state';

/**
 * Syntax is $1, ${2}, ${3:foo}, $0
 * https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#snippet_syntax
 */
export type LSPSnippet = string;

/**
 * Syntax is ${placeholder} or ${1:placeholder} or #{} or ${}
 * https://codemirror.net/docs/ref/#autocomplete.snippet
 */
export type CodeMirrorSnippet = string;

/**
 * This function takes a snippet from the language server and transforms it
 * into the format that CodeMirror expects.
 *
 * There are small nuances w.r.t. $0 but that shouldn't be too much of a
 * problem. ($0 is the "end" cursor position in LSP, CM doesn't have that... so
 * we convert $0 to ${99} :D)
 */
export function translateSnippet(snippet: LSPSnippet): CodeMirrorSnippet {
  let fixed = snippet.replace(/\$(\d)+/g, (_match, index) => {
    return '${' + (Number(index) === 0 ? '99' : index) + '}';
  });

  // Remove references to other placeholders in placeholders. CodeMirror doesn't
  // support those and it's a PITA to implement differently.
  fixed = fixed.replace(
    /\$\{(\d+):([^}$]*)(\$\{\d+\})([^}$]*)\}/g,
    (_match, index, pre, ref, post) => {
      return '${' + index + ':' + pre + post + '}';
    },
  );

  if (fixed.includes('${99}')) {
    return fixed;
  } else {
    return fixed + '${99}';
  }
}
