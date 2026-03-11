(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "vscode-languageserver-protocol", "./LanguageClient", "./extensions", "./extensions/hover"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeMirrorLanguageClient = void 0;
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const LanguageClient_1 = require("./LanguageClient");
    const extensions_1 = require("./extensions");
    const hover_1 = require("./extensions/hover");
    /**
     * The client capabilities are how we tell the language server what
     * features we support so that they have the opportunity to skip doing
     * things that the client does not support. Everything is false by default,
     * but we migth need to change that and this is where we'll do it.
     */
    const clientCapabilities = {
        textDocument: {
            documentHighlight: {
                dynamicRegistration: false,
            },
            completion: {
                // We send the completion context to the server
                contextSupport: true,
                completionItem: {
                    snippetSupport: true,
                    insertReplaceSupport: true,
                    documentationFormat: [vscode_languageserver_protocol_1.MarkupKind.PlainText, vscode_languageserver_protocol_1.MarkupKind.Markdown],
                    commitCharactersSupport: false,
                },
            },
        },
    };
    const defaultLogger = console.log.bind(console);
    // There is one LanguageClient
    // There is one LanguageServer
    // There are many CodeMirror instances
    class CodeMirrorLanguageClient {
        constructor(worker, { log = defaultLogger, initializationOptions } = {}, { infoRenderer, autocompleteOptions, diagnosticRenderer, linterOptions, hoverRenderer, hoverOptions, } = {}) {
            this.worker = worker;
            this.client = new LanguageClient_1.LanguageClient(worker, {
                clientCapabilities,
                initializationOptions,
                log,
            });
            this.worker = worker;
            this.infoRenderer = infoRenderer;
            this.autocompleteExtension = (0, extensions_1.lspComplete)(autocompleteOptions);
            this.diagnosticRenderer = diagnosticRenderer;
            this.linterExtension = (0, extensions_1.lspLinter)(linterOptions);
            this.hoverRenderer = hoverRenderer;
            this.hoverExtension = (0, extensions_1.lspHover)(hoverOptions);
            this.documentHighlightsExtension = (0, extensions_1.lspDocumentHighlights)();
        }
        async start() {
            await this.client.start();
        }
        async stop() {
            try {
                await this.client.stop();
            }
            finally {
                this.worker.terminate();
            }
        }
        extension(fileUri, { shouldLint, shouldComplete, shouldHover } = {
            shouldLint: true,
            shouldComplete: true,
            shouldHover: true,
        }) {
            return [
                extensions_1.clientFacet.of(this.client),
                extensions_1.serverCapabilitiesFacet.of(this.client.serverCapabilities),
                extensions_1.fileUriFacet.of(fileUri),
                extensions_1.textDocumentSync,
                extensions_1.infoRendererFacet.of(this.infoRenderer),
                extensions_1.diagnosticRendererFacet.of(this.diagnosticRenderer),
                hover_1.hoverRendererFacet.of(this.hoverRenderer),
                this.documentHighlightsExtension,
            ]
                .concat(shouldLint ? this.linterExtension : [])
                .concat(shouldComplete ? this.autocompleteExtension : [])
                .concat(shouldHover ? this.hoverExtension : []);
        }
    }
    exports.CodeMirrorLanguageClient = CodeMirrorLanguageClient;
});
//# sourceMappingURL=CodeMirrorLanguageClient.js.map