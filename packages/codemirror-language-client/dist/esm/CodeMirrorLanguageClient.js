import { MarkupKind } from 'vscode-languageserver-protocol';
import { LanguageClient } from './LanguageClient';
import { clientFacet, diagnosticRendererFacet, fileUriFacet, infoRendererFacet, lspComplete, lspDocumentHighlights, lspHover, lspLinter, serverCapabilitiesFacet, textDocumentSync, } from './extensions';
import { hoverRendererFacet } from './extensions/hover';
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
                documentationFormat: [MarkupKind.PlainText, MarkupKind.Markdown],
                commitCharactersSupport: false,
            },
        },
    },
};
const defaultLogger = console.log.bind(console);
// There is one LanguageClient
// There is one LanguageServer
// There are many CodeMirror instances
export class CodeMirrorLanguageClient {
    constructor(worker, { log = defaultLogger, initializationOptions } = {}, { infoRenderer, autocompleteOptions, diagnosticRenderer, linterOptions, hoverRenderer, hoverOptions, } = {}) {
        this.worker = worker;
        this.client = new LanguageClient(worker, {
            clientCapabilities,
            initializationOptions,
            log,
        });
        this.worker = worker;
        this.infoRenderer = infoRenderer;
        this.autocompleteExtension = lspComplete(autocompleteOptions);
        this.diagnosticRenderer = diagnosticRenderer;
        this.linterExtension = lspLinter(linterOptions);
        this.hoverRenderer = hoverRenderer;
        this.hoverExtension = lspHover(hoverOptions);
        this.documentHighlightsExtension = lspDocumentHighlights();
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
            clientFacet.of(this.client),
            serverCapabilitiesFacet.of(this.client.serverCapabilities),
            fileUriFacet.of(fileUri),
            textDocumentSync,
            infoRendererFacet.of(this.infoRenderer),
            diagnosticRendererFacet.of(this.diagnosticRenderer),
            hoverRendererFacet.of(this.hoverRenderer),
            this.documentHighlightsExtension,
        ]
            .concat(shouldLint ? this.linterExtension : [])
            .concat(shouldComplete ? this.autocompleteExtension : [])
            .concat(shouldHover ? this.hoverExtension : []);
    }
}
//# sourceMappingURL=CodeMirrorLanguageClient.js.map