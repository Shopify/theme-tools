"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentLinksProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_uri_1 = require("vscode-uri");
const theme_check_common_2 = require("@shopify/theme-check-common");
class DocumentLinksProvider {
    constructor(documentManager, findThemeRootURI) {
        this.documentManager = documentManager;
        this.findThemeRootURI = findThemeRootURI;
    }
    async documentLinks(uriString) {
        const sourceCode = this.documentManager.get(uriString);
        if (!sourceCode ||
            sourceCode.type !== theme_check_common_1.SourceCodeType.LiquidHtml ||
            sourceCode.ast instanceof Error) {
            return [];
        }
        const rootUri = await this.findThemeRootURI(uriString);
        if (!rootUri) {
            return [];
        }
        const visitor = documentLinksVisitor(sourceCode.textDocument, vscode_uri_1.URI.parse(rootUri));
        return (0, theme_check_common_2.visit)(sourceCode.ast, visitor);
    }
}
exports.DocumentLinksProvider = DocumentLinksProvider;
function documentLinksVisitor(textDocument, root) {
    return {
        LiquidTag(node) {
            // {% render 'snippet' %}
            // {% include 'snippet' %}
            if ((node.name === 'render' || node.name === 'include') &&
                typeof node.markup !== 'string' &&
                isLiquidString(node.markup.snippet)) {
                const snippet = node.markup.snippet;
                return vscode_languageserver_1.DocumentLink.create(range(textDocument, snippet), vscode_uri_1.Utils.resolvePath(root, 'snippets', snippet.value + '.liquid').toString());
            }
            // {% section 'section' %}
            if (node.name === 'section' &&
                typeof node.markup !== 'string' &&
                isLiquidString(node.markup)) {
                const sectionName = node.markup;
                return vscode_languageserver_1.DocumentLink.create(range(textDocument, sectionName), vscode_uri_1.Utils.resolvePath(root, 'sections', sectionName.value + '.liquid').toString());
            }
            // {% content_for 'block', type: 'block_name' %}
            if (node.name === liquid_html_parser_1.NamedTags.content_for && typeof node.markup !== 'string') {
                const typeArg = node.markup.args.find((arg) => arg.name === 'type');
                if (typeArg && typeArg.value.type === 'String') {
                    return vscode_languageserver_1.DocumentLink.create(range(textDocument, typeArg.value), vscode_uri_1.Utils.resolvePath(root, 'blocks', typeArg.value.value + '.liquid').toString());
                }
            }
        },
        // {{ 'theme.js' | asset_url }}
        LiquidVariable(node) {
            if (node.filters.length === 0 || node.filters[0].name !== 'asset_url') {
                return;
            }
            if (!isLiquidString(node.expression)) {
                return;
            }
            const expression = node.expression;
            return vscode_languageserver_1.DocumentLink.create(range(textDocument, node.expression), vscode_uri_1.Utils.resolvePath(root, 'assets', expression.value).toString());
        },
    };
}
function range(textDocument, node) {
    const start = textDocument.positionAt(node.position.start + 1);
    const end = textDocument.positionAt(node.position.end - 1);
    return vscode_languageserver_1.Range.create(start, end);
}
function isLiquidString(node) {
    return node.type === liquid_html_parser_1.NodeTypes.String;
}
//# sourceMappingURL=DocumentLinksProvider.js.map