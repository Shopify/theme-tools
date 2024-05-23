import { LanguageService, TextDocument, getLanguageService } from 'vscode-json-languageservice';
import { SchemaDefinition, SourceCodeType, ValidateJSON } from './types';
import { indexBy } from './utils';

export class JSONValidator {
  private service: LanguageService;
  private schemas: Record<string, SchemaDefinition>;

  constructor(schemas: SchemaDefinition[]) {
    this.schemas = indexBy((x) => x.uri, schemas);
    this.service = getLanguageService({
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

  /**
   * Will return an array of diagnostics for the given source code and JSON string.
   *
   * It's up to the caller to determine where in the file those should be.
   * (presumably by doing some offset logic)
   */
  public validate: ValidateJSON<SourceCodeType> = async (sourceCode, jsonString) => {
    const jsonTextDocument = TextDocument.create(
      'file:' + sourceCode.absolutePath,
      'json',
      0,
      jsonString,
    );
    const jsonDocument = this.service.parseJSONDocument(jsonTextDocument);
    const diagnostics = await this.service.doValidation(jsonTextDocument, jsonDocument, {
      schemaValidation: 'error',
      trailingCommas: 'ignore',
      comments: 'ignore',
    });
    return diagnostics.map((diagnostic) => ({
      message: diagnostic.message,
      startIndex: jsonTextDocument.offsetAt(diagnostic.range.start),
      endIndex: jsonTextDocument.offsetAt(diagnostic.range.end),
    }));
  };

  private async getSchemaForURI(uri: string): Promise<string> {
    const schema = this.schemas[uri]?.schema;
    if (!schema) return `No schema for '${uri}' found`;
    return schema;
  }
}
