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
export declare function translateSnippet(snippet: LSPSnippet): CodeMirrorSnippet;
