import { LiquidRawTag, NodeTypes } from '@shopify/liquid-html-parser';
import {
  JsonValidationSet,
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
  private service: LanguageService | null = null;
  private schemas: Record<string, SchemaDefinition>;

  constructor(
    private documentManager: DocumentManager,
    private jsonValidationSet: JsonValidationSet,
    private getDefaultSchemaTranslations: GetTranslationsForURI,
  ) {
    this.schemas = indexBy((x) => x.uri, this.jsonValidationSet.schemas);
  }

  setup(clientCapabilities: LSPClientCapabilities) {
    this.service = getLanguageService({
      schemaRequestService: this.getSchemaForURI.bind(this),
      contributions: [
        new TranslationFileContributions(this.documentManager),
        new SchemaTranslationContributions(this.documentManager, this.getDefaultSchemaTranslations),
      ],
      clientCapabilities,
    });
    this.service.configure({
      schemas: this.jsonValidationSet.schemas.map((schemaDefinition) => ({
        uri: schemaDefinition.uri,
        fileMatch: schemaDefinition.fileMatch,
      })),
    });
  }

  async completions(params: CompletionParams): Promise<null | CompletionList | CompletionItem[]> {
    if (!this.service) return null;
    const documents = this.getDocuments(params);
    if (!documents) return null;
    const [jsonTextDocument, jsonDocument] = documents;
    return this.service.doComplete(jsonTextDocument, params.position, jsonDocument);
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    if (!this.service) return null;
    const documents = this.getDocuments(params);
    if (!documents) return null;
    const [jsonTextDocument, jsonDocument] = documents;
    return this.service.doHover(jsonTextDocument, params.position, jsonDocument);
  }

  private getDocuments(
    params: HoverParams | CompletionParams,
  ): [TextDocument, JSONDocument] | null {
    if (!this.service) return null;

    const document = this.documentManager.get(params.textDocument.uri);
    if (!document) return null;

    switch (document.type) {
      case SourceCodeType.JSON: {
        const jsonTextDocument = document.textDocument;
        const jsonDocument = this.service.parseJSONDocument(jsonTextDocument);
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
        const jsonDocument = this.service.parseJSONDocument(jsonTextDocument);
        return [jsonTextDocument, jsonDocument];
      }
    }
  }

  private async getSchemaForURI(uri: string): Promise<string> {
    const promise = this.schemas[uri]?.schema;
    if (!promise) return `Could not get schema for '${uri}'`;
    return promise;
  }
}
