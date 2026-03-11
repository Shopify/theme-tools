"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationCompletionProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const vscode_languageserver_1 = require("vscode-languageserver");
const translations_1 = require("../../translations");
const theme_check_common_1 = require("@shopify/theme-check-common");
class TranslationCompletionProvider {
    constructor(documentManager, getTranslationsForURI) {
        this.documentManager = documentManager;
        this.getTranslationsForURI = getTranslationsForURI;
    }
    async completions(params) {
        if (!params.completionContext)
            return [];
        const { node, ancestors } = params.completionContext;
        const parentNode = ancestors.at(-1);
        const document = this.documentManager.get(params.textDocument.uri);
        if (!node ||
            node.type !== liquid_html_parser_1.NodeTypes.String ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidVariable ||
            !document) {
            return [];
        }
        const ast = document.ast;
        const textDocument = document.textDocument;
        const translations = await this.getTranslationsForURI(params.textDocument.uri);
        const partial = node.value;
        // We only want to show standard translations to complete if the translation
        // is prefixed by shopify. Otherwise it's too noisy.
        const options = (0, translations_1.translationOptions)(translations).filter((option) => { var _a; return !((_a = option.path[0]) === null || _a === void 0 ? void 0 : _a.startsWith('shopify')) || partial.startsWith('shopify'); });
        const [_currentNode, realAncestors] = ast instanceof Error
            ? [null, []]
            : (0, theme_check_common_1.findCurrentNode)(ast, textDocument.offsetAt(params.position));
        // That part feels kind of gross, let me explain...
        // When we complete translations, we also want to append the `| t` after the
        // string, but we should only ever do that if the variable didn't _already_ have that.
        // But since our completion engine works on incomplete code, we need to temporarily
        // fetch the real node to do the optional | t completion.
        const realParentNode = realAncestors.at(-1);
        let shouldAppendTranslateFilter = (realParentNode === null || realParentNode === void 0 ? void 0 : realParentNode.type) === liquid_html_parser_1.NodeTypes.LiquidVariable && (realParentNode === null || realParentNode === void 0 ? void 0 : realParentNode.filters.length) === 0;
        const quote = node.single ? "'" : '"';
        let postFix = quote + ' | t';
        let replaceRange;
        if (shouldAppendTranslateFilter) {
            postFix = quote + ' | t';
            replaceRange = {
                start: textDocument.positionAt(node.position.start + 1), // minus the quote characters
                end: textDocument.positionAt(node.position.end), // including quote
            };
        }
        else {
            postFix = '';
            replaceRange = {
                start: textDocument.positionAt(node.position.start + 1), // minus the quote characters
                end: textDocument.positionAt(node.position.end - 1), // excluding quote
            };
        }
        const insertTextStartIndex = partial.lastIndexOf('.') + 1;
        return options.map(({ path, translation }) => {
            var _a;
            const params = (0, translations_1.extractParams)(typeof translation === 'string' ? translation : ((_a = Object.values(translation)[0]) !== null && _a !== void 0 ? _a : ''));
            const parameters = (0, translations_1.paramsString)(params);
            return {
                label: quote + path.join('.') + quote + ' | t', // don't want the count here because it feels noisy(?)
                insertText: path.join('.').slice(insertTextStartIndex), // for editors that don't support textEdit
                kind: vscode_languageserver_1.CompletionItemKind.Field,
                textEdit: vscode_languageserver_1.TextEdit.replace(replaceRange, path.join('.') + postFix + (shouldAppendTranslateFilter ? parameters : '')),
                documentation: {
                    kind: 'markdown',
                    value: (0, translations_1.renderTranslation)(translation),
                },
            };
        });
    }
}
exports.TranslationCompletionProvider = TranslationCompletionProvider;
//# sourceMappingURL=TranslationCompletionProvider.js.map