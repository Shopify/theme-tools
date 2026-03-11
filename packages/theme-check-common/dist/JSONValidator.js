"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONValidator = void 0;
exports.isValid = isValid;
const vscode_json_languageservice_1 = require("vscode-json-languageservice");
const utils_1 = require("./utils");
class JSONValidator {
    static async create(jsonValidationSet, config) {
        if (!jsonValidationSet)
            return;
        return new JSONValidator(await jsonValidationSet.schemas(config.context));
    }
    constructor(schemas) {
        /**
         * Will return an array of diagnostics for the given source code and JSON string.
         *
         * It's up to the caller to determine where in the file those should be.
         * (presumably by doing some offset logic)
         */
        this.validate = async (uri, jsonString) => {
            const jsonTextDocument = vscode_json_languageservice_1.TextDocument.create(uri, 'json', 0, jsonString);
            const diagnostics = await this.getOffsetDiagnostics(jsonTextDocument);
            return diagnostics.map((diagnostic) => ({
                message: diagnostic.message,
                startIndex: jsonTextDocument.offsetAt(diagnostic.range.start),
                endIndex: jsonTextDocument.offsetAt(diagnostic.range.end),
            }));
        };
        this.isValid = async (uri, jsonString) => {
            return isValid(this.service, uri, jsonString);
        };
        this.schemas = (0, utils_1.indexBy)((x) => x.uri, schemas);
        this.service = (0, vscode_json_languageservice_1.getLanguageService)({
            schemaRequestService: this.getSchemaForURI.bind(this),
            workspaceContext: {
                resolveRelativePath: (relativePath, resource) => {
                    const url = new URL(relativePath, resource);
                    return url.toString();
                },
            },
        });
        this.service.configure({
            schemas: schemas.map((schemaDefinition) => ({
                uri: schemaDefinition.uri,
                fileMatch: schemaDefinition.fileMatch,
            })),
        });
    }
    async getOffsetDiagnostics(jsonTextDocument) {
        const jsonDocument = this.service.parseJSONDocument(jsonTextDocument);
        return this.service.doValidation(jsonTextDocument, jsonDocument, {
            schemaValidation: 'error',
            trailingCommas: 'ignore',
            comments: 'ignore',
        });
    }
    async getSchemaForURI(uri) {
        var _a;
        const schema = (_a = this.schemas[uri]) === null || _a === void 0 ? void 0 : _a.schema;
        if (!schema)
            return `No schema for '${uri}' found`;
        return schema;
    }
}
exports.JSONValidator = JSONValidator;
/** We'll reuse this in the language server */
async function isValid(service, uri, jsonString) {
    const jsonTextDocument = vscode_json_languageservice_1.TextDocument.create(uri, 'json', 0, jsonString);
    const jsonDocument = service.parseJSONDocument(jsonTextDocument);
    const diagnostics = await service.doValidation(jsonTextDocument, jsonDocument, {
        schemaValidation: 'error',
        trailingCommas: 'ignore',
        comments: 'ignore',
    });
    return diagnostics.every((diagnostic) => diagnostic.severity !== 1);
}
//# sourceMappingURL=JSONValidator.js.map