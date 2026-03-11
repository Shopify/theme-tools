"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSLanguageService = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_css_languageservice_1 = require("vscode-css-languageservice");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
class CSSLanguageService {
    constructor(documentManager) {
        this.documentManager = documentManager;
        this.service = null;
    }
    async setup(clientCapabilities) {
        this.service = (0, vscode_css_languageservice_1.getCSSLanguageService)({
            clientCapabilities,
        });
    }
    async completions(params) {
        const service = this.service;
        if (!service)
            return null;
        const documents = this.getDocuments(params, service);
        if (!documents)
            return null;
        const [stylesheetTextDocument, stylesheetDocument] = documents;
        return service.doComplete(stylesheetTextDocument, params.position, stylesheetDocument);
    }
    async diagnostics(params) {
        const service = this.service;
        if (!service)
            return [];
        const documents = this.getDocuments(params, service);
        if (!documents)
            return [];
        const [stylesheetTextDocument, stylesheetDocument] = documents;
        return service.doValidation(stylesheetTextDocument, stylesheetDocument);
    }
    async hover(params) {
        const service = this.service;
        if (!service)
            return null;
        const documents = this.getDocuments(params, service);
        if (!documents)
            return null;
        const [stylesheetTextDocument, stylesheetDocument] = documents;
        return service.doHover(stylesheetTextDocument, params.position, stylesheetDocument);
    }
    getDocuments(params, service) {
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document)
            return null;
        switch (document.type) {
            case theme_check_common_1.SourceCodeType.JSON: {
                return null;
            }
            case theme_check_common_1.SourceCodeType.LiquidHtml: {
                if (document.ast instanceof Error)
                    return null;
                const textDocument = document.textDocument;
                let offset = 0;
                let isDiagnostics = false;
                if ('position' in params && params.position.line !== 0 && params.position.character !== 0) {
                    offset = textDocument.offsetAt(params.position);
                }
                else {
                    const stylesheetIndex = document.source.indexOf('{% stylesheet %}');
                    offset = stylesheetIndex;
                    isDiagnostics = true;
                }
                const [node, ancestors] = (0, theme_check_common_1.findCurrentNode)(document.ast, offset);
                let stylesheetTag = [...ancestors].find((node) => node.type === liquid_html_parser_1.NodeTypes.LiquidRawTag && node.name === 'stylesheet');
                if (isDiagnostics && 'children' in node && node.children) {
                    stylesheetTag = node.children.find((node) => node.type === liquid_html_parser_1.NodeTypes.LiquidRawTag && node.name === 'stylesheet');
                }
                if (!stylesheetTag)
                    return null;
                const schemaLineNumber = textDocument.positionAt(stylesheetTag.blockStartPosition.end).line;
                // Hacking away "same line numbers" here by prefixing the file with newlines
                // This way params.position will be at the same line number in this fake jsonTextDocument
                // Which means that the completions will be at the same line number in the Liquid document
                const stylesheetString = Array(schemaLineNumber).fill('\n').join('') +
                    stylesheetTag.source
                        .slice(stylesheetTag.blockStartPosition.end, stylesheetTag.blockEndPosition.start)
                        .replace(/\n$/, ''); // Remove trailing newline so parsing errors don't show up on `{% endstylesheet %}`
                const stylesheetTextDocument = vscode_languageserver_textdocument_1.TextDocument.create(textDocument.uri, 'json', textDocument.version, stylesheetString);
                const stylesheetDocument = service.parseStylesheet(stylesheetTextDocument);
                return [stylesheetTextDocument, stylesheetDocument];
            }
        }
    }
}
exports.CSSLanguageService = CSSLanguageService;
//# sourceMappingURL=CSSLanguageService.js.map