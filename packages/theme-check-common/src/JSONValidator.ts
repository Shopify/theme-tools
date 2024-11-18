import { LanguageService, TextDocument, getLanguageService } from 'vscode-json-languageservice';
import { Config, Dependencies, IsValidSchema, SchemaDefinition, ValidateJSON } from './types';
import { indexBy } from './utils';

export class JSONValidator {
  private service: LanguageService;
  private schemas: Record<string, SchemaDefinition>;

  static async create(
    jsonValidationSet: Dependencies['jsonValidationSet'],
    config: Config,
  ): Promise<JSONValidator | undefined> {
    if (!jsonValidationSet) return;
    return new JSONValidator(await jsonValidationSet.schemas(config.context));
  }

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
  public validate: ValidateJSON = async (uri: string, jsonString: string) => {
    const jsonTextDocument = TextDocument.create(uri, 'json', 0, jsonString);
    const diagnostics = await this.getOffsetDiagnostics(jsonTextDocument);
    return diagnostics.map((diagnostic) => ({
      message: diagnostic.message,
      startIndex: jsonTextDocument.offsetAt(diagnostic.range.start),
      endIndex: jsonTextDocument.offsetAt(diagnostic.range.end),
    }));
  };

  public isValid: IsValidSchema = async (uri: string, jsonString: string) => {
    return isValid(this.service, uri, jsonString);
  };

  private async getOffsetDiagnostics(jsonTextDocument: TextDocument) {
    const jsonDocument = this.service.parseJSONDocument(jsonTextDocument);
    return this.service.doValidation(jsonTextDocument, jsonDocument, {
      schemaValidation: 'error',
      trailingCommas: 'ignore',
      comments: 'ignore',
    });
  }

  private async getSchemaForURI(uri: string): Promise<string> {
    const schema = this.schemas[uri]?.schema;
    if (!schema) return `No schema for '${uri}' found`;
    return schema;
  }
}

/** We'll reuse this in the language server */
export async function isValid(service: LanguageService, uri: string, jsonString: string) {
  const jsonTextDocument = TextDocument.create(uri, 'json', 0, jsonString);
  const jsonDocument = service.parseJSONDocument(jsonTextDocument);
  const diagnostics = await service.doValidation(jsonTextDocument, jsonDocument, {
    schemaValidation: 'error',
    trailingCommas: 'ignore',
    comments: 'ignore',
  });
  return diagnostics.every((diagnostic) => diagnostic.severity !== 1);
}
