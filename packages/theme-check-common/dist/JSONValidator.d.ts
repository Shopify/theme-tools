import { LanguageService } from 'vscode-json-languageservice';
import { Config, Dependencies, IsValidSchema, SchemaDefinition, ValidateJSON } from './types';
export declare class JSONValidator {
    private service;
    private schemas;
    static create(jsonValidationSet: Dependencies['jsonValidationSet'], config: Config): Promise<JSONValidator | undefined>;
    constructor(schemas: SchemaDefinition[]);
    /**
     * Will return an array of diagnostics for the given source code and JSON string.
     *
     * It's up to the caller to determine where in the file those should be.
     * (presumably by doing some offset logic)
     */
    validate: ValidateJSON;
    isValid: IsValidSchema;
    private getOffsetDiagnostics;
    private getSchemaForURI;
}
/** We'll reuse this in the language server */
export declare function isValid(service: LanguageService, uri: string, jsonString: string): Promise<boolean>;
