"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HtmlElementAutoclosingOnTypeFormattingProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const theme_check_common_1 = require("@shopify/theme-check-common");
const defer = (fn) => setTimeout(fn, 10);
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
class HtmlElementAutoclosingOnTypeFormattingProvider {
    constructor(setCursorPosition) {
        this.setCursorPosition = setCursorPosition;
    }
    onTypeFormatting(document, params) {
        const textDocument = document.textDocument;
        const ch = params.ch;
        // position is position of cursor so 1 ahead of char
        const { line, character } = params.position;
        switch (ch) {
            // here we fix `>` with `</$unclosed>`
            case '>': {
                const ast = document.ast;
                if (ast instanceof liquid_html_parser_1.LiquidHTMLASTParsingError &&
                    ast.unclosed &&
                    ast.unclosed.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
                    (ast.unclosed.blockStartPosition.end === textDocument.offsetAt(params.position) ||
                        shouldClose(ast.unclosed, nodeAtCursor(textDocument, params.position)))) {
                    defer(() => this.setCursorPosition(textDocument, params.position));
                    return [vscode_languageserver_protocol_1.TextEdit.insert(vscode_languageserver_protocol_1.Position.create(line, character), `</${ast.unclosed.name}>`)];
                }
                else if (!(ast instanceof Error)) {
                    // Even though we accept dangling <div>s inside {% if condition %}, we prefer to auto-insert the </div>
                    const [node] = (0, theme_check_common_1.findCurrentNode)(ast, textDocument.offsetAt(params.position));
                    if (isDanglingHtmlElement(node)) {
                        defer(() => this.setCursorPosition(textDocument, params.position));
                        return [vscode_languageserver_protocol_1.TextEdit.insert(vscode_languageserver_protocol_1.Position.create(line, character), `</${(0, liquid_html_parser_1.getName)(node)}>`)];
                    }
                }
            }
        }
        return null;
    }
}
exports.HtmlElementAutoclosingOnTypeFormattingProvider = HtmlElementAutoclosingOnTypeFormattingProvider;
function nodeAtCursor(textDocument, position) {
    var _a;
    const text = textDocument.getText(vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(0, 0), position));
    try {
        const ast = (0, liquid_html_parser_1.toLiquidHtmlAST)(text, {
            allowUnclosedDocumentNode: true,
            mode: 'tolerant',
        });
        const [node, ancestors] = (0, theme_check_common_1.findCurrentNode)(ast, textDocument.offsetAt(position));
        if (((_a = ancestors.at(-1)) === null || _a === void 0 ? void 0 : _a.type) === liquid_html_parser_1.NodeTypes.HtmlElement)
            return ancestors.at(-1);
        if (node.type === liquid_html_parser_1.NodeTypes.LiquidBranch)
            return ancestors.at(-1);
        return node;
    }
    catch {
        return null;
    }
}
function shouldClose(unclosed, node) {
    if (node === null || !('blockStartPosition' in node))
        return false;
    return ([liquid_html_parser_1.NodeTypes.HtmlElement, liquid_html_parser_1.NodeTypes.LiquidTag, liquid_html_parser_1.NodeTypes.HtmlRawNode].includes(unclosed.type) &&
        (0, liquid_html_parser_1.getName)(node) === unclosed.name);
}
function isDanglingHtmlElement(node) {
    return (node !== null &&
        node.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
        node.blockEndPosition.start === node.blockEndPosition.end);
}
//# sourceMappingURL=HtmlElementAutoclosingOnTypeFormattingProvider.js.map