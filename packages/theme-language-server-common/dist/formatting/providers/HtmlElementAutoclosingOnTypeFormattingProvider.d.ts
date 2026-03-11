import { DocumentOnTypeFormattingParams, TextEdit } from 'vscode-languageserver-protocol';
import { AugmentedLiquidSourceCode } from '../../documents';
import { BaseOnTypeFormattingProvider, SetCursorPosition } from '../types';
/**
 * This class is responsible for closing dangling HTML elements.
 *
 * Say user types <script>, then we'd want `</script>` to be inserted.
 *
 * Thing is we want to do that only if the `</script>` isn't already present in the file.
 * If the user goes to edit `<script>` and types `>`, we don't want to insert `</script>` again.
 *
 * The "trick" we use here is to only add the `</script>` part if the
 * document.ast is an instance of LiquidHTMLASTParsingError and that the
 * unclosed element is of the correct name.
 *
 * @example:
 * ```html
 *   <div id="main">
 *     <div id="inner">|
 *   </div>
 * ```
 * - The user just finished typing `<div id="inner">` inside the div#main.
 * - This parses as though the div#inner is closed and div#main isn't.
 * - That's OK.
 * - This makes a LiquidHTMLASTParsingError with unclosed div (the div#main).
 * - Since
 *     - the cursor is at the end of a div, and
 *     - the unclosed element is a div,
 *   Then we can insert one automatically after the cursor and fix the AST.
 *
 * ```html
 *  <div id="main">
 *    <div id="inner">|</div>
 *  </div>
 * ```
 */
export declare class HtmlElementAutoclosingOnTypeFormattingProvider implements BaseOnTypeFormattingProvider {
    private setCursorPosition;
    constructor(setCursorPosition: SetCursorPosition);
    onTypeFormatting(document: AugmentedLiquidSourceCode, params: DocumentOnTypeFormattingParams): TextEdit[] | null;
}
