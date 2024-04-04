import { LiquidRawTag, NodeTypes } from '@shopify/liquid-html-parser';
import {
  JsonValidationSet,
  Mode,
  Modes,
  SchemaDefinition,
  SourceCodeType,
  indexBy,
} from '@shopify/theme-check-common';
import { JSONDocument, LanguageService, getLanguageService } from 'vscode-json-languageservice';
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Hover,
  HoverParams,
  ClientCapabilities as LSPClientCapabilities,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../documents';
import { findCurrentNode } from '../visitor';
import { TranslationFileContributions } from './TranslationFileContributions';
import { SchemaTranslationContributions } from './SchemaTranslationContributions';
import { GetTranslationsForURI } from '../translations';

export class JSONLanguageService {
  // We index by Mode here because I don't want to reconfigure the service depending on the URI.
  // This is because you may be in a "app" context in one folder, and in a "theme" context in another one.
  // Because theme app extensions and themes do not share a common JSON schema for blocks/*.liquid files,
  // we need to do this switch on mode here to figure out which language service we will use to power
  // completions/hover. The mode comes from the theme check config.
  private services: Record<Mode, LanguageService | null>;

  // One record for all modes since collisions on URIs should point to the same schema
  private schemas: Record<string, SchemaDefinition>;

  constructor(
    private documentManager: DocumentManager,
    private jsonValidationSet: JsonValidationSet,
    private getDefaultSchemaTranslations: GetTranslationsForURI,
    private getModeForURI: (uri: string) => Promise<Mode>,
  ) {
    this.services = Object.fromEntries(Modes.map((mode) => [mode, null])) as typeof this.services;
    this.schemas = {};
  }

  async setup(clientCapabilities: LSPClientCapabilities) {
    await Promise.all(
      Modes.map(async (mode) => {
        const schemas = await this.jsonValidationSet.schemas(mode);
        for (const schema of schemas) {
          this.schemas[schema.uri] = schema;
        }

        if (!schemas.length) return;

        const service = getLanguageService({
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

          // Custom non-JSON schema completion & hover contributions
          contributions: [
            new TranslationFileContributions(this.documentManager),
            new SchemaTranslationContributions(
              this.documentManager,
              this.getDefaultSchemaTranslations,
            ),
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
      }),
    );
  }

  async completions(params: CompletionParams): Promise<null | CompletionList | CompletionItem[]> {
    const mode = await this.getModeForURI(params.textDocument.uri);
    const service = this.services[mode];
    if (!service) return null;
    const documents = this.getDocuments(params, service);
    if (!documents) return null;
    const [jsonTextDocument, jsonDocument] = documents;
    return service.doComplete(jsonTextDocument, params.position, jsonDocument);
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    const mode = await this.getModeForURI(params.textDocument.uri);
    const service = this.services[mode];
    if (!service) return null;
    const documents = this.getDocuments(params, service);
    if (!documents) return null;
    const [jsonTextDocument, jsonDocument] = documents;
    return service.doHover(jsonTextDocument, params.position, jsonDocument);
  }

  private getDocuments(
    params: HoverParams | CompletionParams,
    service: LanguageService,
  ): [TextDocument, JSONDocument] | null {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document) return null;

    switch (document.type) {
      case SourceCodeType.JSON: {
        const jsonTextDocument = document.textDocument;
        const jsonDocument = service.parseJSONDocument(jsonTextDocument);
        return [jsonTextDocument, jsonDocument];
      }

      case SourceCodeType.LiquidHtml: {
        if (document.ast instanceof Error) return null;
        const textDocument = document.textDocument;
        const offset = textDocument.offsetAt(params.position);
        const [_, ancestors] = findCurrentNode(document.ast, offset);
        const schema = ancestors.find(
          (node): node is LiquidRawTag =>
            node.type === NodeTypes.LiquidRawTag && node.name === 'schema',
        );
        if (!schema) return null;

        const schemaLineNumber = textDocument.positionAt(schema.blockStartPosition.end).line;
        // Hacking away "same line numbers" here by prefixing the file with newlines
        // This way params.position will be at the same line number in this fake jsonTextDocument
        // Which means that the completions will be at the same line number in the Liquid document
        const jsonString =
          Array(schemaLineNumber).fill('\n').join('') +
          schema.source.slice(schema.blockStartPosition.end, schema.blockEndPosition.start);
        const jsonTextDocument = TextDocument.create(
          textDocument.uri,
          'json',
          textDocument.version,
          jsonString,
        );
        const jsonDocument = service.parseJSONDocument(jsonTextDocument);
        return [jsonTextDocument, jsonDocument];
      }
    }
  }

  private async getSchemaForURI(uri: string): Promise<string> {
    const schema = this.schemas[uri]?.schema;
    if (!schema) return `Could not get schema for '${uri}'`;
    return schema;
  }
}
