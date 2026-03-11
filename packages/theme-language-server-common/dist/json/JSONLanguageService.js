"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONLanguageService = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_json_languageservice_1 = require("vscode-json-languageservice");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const JSONContributions_1 = require("./JSONContributions");
const DocumentLinksProvider_1 = require("./documentLinks/DocumentLinksProvider");
const vscode_uri_1 = require("vscode-uri");
class JSONLanguageService {
    constructor(documentManager, jsonValidationSet, getDefaultSchemaTranslations, getModeForURI, getThemeBlockNames, getThemeBlockSchema, findThemeRootURI) {
        this.documentManager = documentManager;
        this.jsonValidationSet = jsonValidationSet;
        this.getDefaultSchemaTranslations = getDefaultSchemaTranslations;
        this.getModeForURI = getModeForURI;
        this.getThemeBlockNames = getThemeBlockNames;
        this.getThemeBlockSchema = getThemeBlockSchema;
        this.findThemeRootURI = findThemeRootURI;
        this.initialize = () => { };
        this.isValidSchema = async (uri, jsonString) => {
            await this.initialized;
            const mode = await this.getModeForURI(uri);
            const service = this.services[mode];
            if (!service)
                return false;
            return (0, theme_check_common_1.isValid)(service, uri, jsonString);
        };
        this.services = Object.fromEntries(theme_check_common_1.Modes.map((mode) => [mode, null]));
        this.schemas = {};
        this.initialized = new Promise((resolve) => {
            this.initialize = resolve;
        });
    }
    async setup(clientCapabilities) {
        const promises = theme_check_common_1.Modes.map(async (mode) => {
            const schemas = await this.jsonValidationSet.schemas(mode);
            for (const schema of schemas) {
                this.schemas[schema.uri] = schema;
            }
            if (!schemas.length)
                return;
            const service = (0, vscode_json_languageservice_1.getLanguageService)({
                clientCapabilities,
                // Map URIs to schemas without making network requests. Removes the
                // network dependency.
                schemaRequestService: this.getSchemaForURI.bind(this),
                // This is how we make sure that our "$ref": "./inputSettings.json" in
                // our JSON schemas resolve correctly.
                workspaceContext: {
                    resolveRelativePath: (relativePath, resource) => {
                        const url = new URL(relativePath, resource);
                        return url.toString();
                    },
                },
                contributions: [
                    new JSONContributions_1.JSONContributions(this.documentManager, this.getDefaultSchemaTranslations, this.getThemeBlockNames, this.getThemeBlockSchema),
                ],
            });
            service.configure({
                // This is what we use to map file names to JSON schemas. Without
                // this, we'd need folks to use the `$schema` field in their JSON
                // blobs. That ain't fun nor is going to happen.
                schemas: schemas.map((schemaDefinition) => ({
                    uri: schemaDefinition.uri,
                    fileMatch: schemaDefinition.fileMatch,
                })),
            });
            this.services[mode] = service;
        });
        await Promise.all(promises);
        this.initialize();
    }
    async completions(params) {
        await this.initialized;
        const mode = await this.getModeForURI(params.textDocument.uri);
        const service = this.services[mode];
        if (!service)
            return null;
        const documents = this.getDocuments(params, service);
        if (!documents)
            return null;
        const [jsonTextDocument, jsonDocument] = documents;
        return service.doComplete(jsonTextDocument, params.position, jsonDocument);
    }
    async hover(params) {
        await this.initialized;
        const mode = await this.getModeForURI(params.textDocument.uri);
        const service = this.services[mode];
        if (!service)
            return null;
        const documents = this.getDocuments(params, service);
        if (!documents)
            return null;
        const [jsonTextDocument, jsonDocument] = documents;
        return service.doHover(jsonTextDocument, params.position, jsonDocument);
    }
    async documentLinks(params) {
        await this.initialized;
        const rootUri = await this.findThemeRootURI(params.textDocument.uri);
        if (!rootUri)
            return [];
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document)
            return [];
        switch (document.type) {
            case theme_check_common_1.SourceCodeType.JSON: {
                if (document.ast instanceof Error)
                    return [];
                const visitor = (0, DocumentLinksProvider_1.createJSONDocumentLinksVisitor)(document.textDocument, vscode_uri_1.URI.parse(rootUri));
                return (0, theme_check_common_1.visit)(document.ast, visitor);
            }
            case theme_check_common_1.SourceCodeType.LiquidHtml: {
                if (document.ast instanceof Error)
                    return [];
                const textDocument = document.textDocument;
                const links = [];
                const schema = await document.getSchema();
                if (schema && !(schema.ast instanceof Error)) {
                    const visitor = (0, DocumentLinksProvider_1.createJSONDocumentLinksVisitor)(textDocument, vscode_uri_1.URI.parse(rootUri), schema.offset);
                    const schemaLinks = (0, theme_check_common_1.visit)(schema.ast, visitor);
                    links.push(...schemaLinks);
                }
                return links;
            }
            default:
                return [];
        }
    }
    getDocuments(params, service) {
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document)
            return null;
        switch (document.type) {
            case theme_check_common_1.SourceCodeType.JSON: {
                const jsonTextDocument = document.textDocument;
                const jsonDocument = service.parseJSONDocument(jsonTextDocument);
                return [jsonTextDocument, jsonDocument];
            }
            case theme_check_common_1.SourceCodeType.LiquidHtml: {
                if (document.ast instanceof Error)
                    return null;
                const textDocument = document.textDocument;
                const offset = textDocument.offsetAt(params.position);
                const [_, ancestors] = (0, theme_check_common_1.findCurrentNode)(document.ast, offset);
                const schema = ancestors.find((node) => node.type === liquid_html_parser_1.NodeTypes.LiquidRawTag && node.name === 'schema');
                if (!schema)
                    return null;
                const schemaLineNumber = textDocument.positionAt(schema.blockStartPosition.end).line;
                // Hacking away "same line numbers" here by prefixing the file with newlines
                // This way params.position will be at the same line number in this fake jsonTextDocument
                // Which means that the completions will be at the same line number in the Liquid document
                const jsonString = Array(schemaLineNumber).fill('\n').join('') +
                    schema.source.slice(schema.blockStartPosition.end, schema.blockEndPosition.start);
                const jsonTextDocument = vscode_languageserver_textdocument_1.TextDocument.create(textDocument.uri, 'json', textDocument.version, jsonString);
                const jsonDocument = service.parseJSONDocument(jsonTextDocument);
                return [jsonTextDocument, jsonDocument];
            }
        }
    }
    async getSchemaForURI(uri) {
        var _a;
        const schema = (_a = this.schemas[uri]) === null || _a === void 0 ? void 0 : _a.schema;
        if (!schema)
            return `Could not get schema for '${uri}'`;
        return schema;
    }
}
exports.JSONLanguageService = JSONLanguageService;
//# sourceMappingURL=JSONLanguageService.js.map