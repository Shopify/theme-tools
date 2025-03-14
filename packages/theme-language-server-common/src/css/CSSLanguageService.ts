import { LiquidRawTag, NodeTypes } from '@shopify/liquid-html-parser';
import { Mode, Modes, SourceCodeType, findCurrentNode } from '@shopify/theme-check-common';
import { LanguageService, Stylesheet, getCSSLanguageService } from 'vscode-css-languageservice';
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Diagnostic,
  DocumentDiagnosticParams,
  Hover,
  HoverParams,
  ClientCapabilities as LSPClientCapabilities,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../documents';

export class CSSLanguageService {
  private service: LanguageService | null = null;

  constructor(private documentManager: DocumentManager) {}

  async setup(clientCapabilities: LSPClientCapabilities) {
    this.service = getCSSLanguageService({
      clientCapabilities,
    });
  }

  async completions(params: CompletionParams): Promise<null | CompletionList | CompletionItem[]> {
    const service = this.service;
    if (!service) return null;
    const documents = this.getDocuments(params, service);
    if (!documents) return null;
    const [stylesheetTextDocument, stylesheetDocument] = documents;
    return service.doComplete(stylesheetTextDocument, params.position, stylesheetDocument);
  }

  async diagnostics(params: DocumentDiagnosticParams): Promise<Diagnostic[]> {
    const service = this.service;
    if (!service) return [];
    const documents = this.getDocuments(params, service);
    if (!documents) return [];
    const [stylesheetTextDocument, stylesheetDocument] = documents;
    return service.doValidation(stylesheetTextDocument, stylesheetDocument);
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    const service = this.service;
    if (!service) return null;
    const documents = this.getDocuments(params, service);
    if (!documents) return null;
    const [stylesheetTextDocument, stylesheetDocument] = documents;
    return service.doHover(stylesheetTextDocument, params.position, stylesheetDocument);
  }

  private getDocuments(
    params: HoverParams | CompletionParams | DocumentDiagnosticParams,
    service: LanguageService,
  ): [TextDocument, Stylesheet] | null {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document) return null;

    switch (document.type) {
      case SourceCodeType.JSON: {
        return null;
      }
      case SourceCodeType.LiquidHtml: {
        if (document.ast instanceof Error) return null;
        const textDocument = document.textDocument;
        let offset = 0;
        let isDiagnostics = false;
        if ('position' in params && params.position.line !== 0 && params.position.character !== 0) {
          offset = textDocument.offsetAt(params.position);
        } else {
          const stylesheetIndex = document.source.indexOf('{% stylesheet %}');
          offset = stylesheetIndex;
          isDiagnostics = true;
        }
        const [node, ancestors] = findCurrentNode(document.ast, offset);
        let stylesheetTag = [...ancestors].find(
          (node): node is LiquidRawTag =>
            node.type === NodeTypes.LiquidRawTag && node.name === 'stylesheet',
        );
        if (isDiagnostics && 'children' in node && node.children) {
          stylesheetTag = node.children.find(
            (node): node is LiquidRawTag =>
              node.type === NodeTypes.LiquidRawTag && node.name === 'stylesheet',
          );
        }

        if (!stylesheetTag) return null;

        const schemaLineNumber = textDocument.positionAt(stylesheetTag.blockStartPosition.end).line;
        // Hacking away "same line numbers" here by prefixing the file with newlines
        // This way params.position will be at the same line number in this fake jsonTextDocument
        // Which means that the completions will be at the same line number in the Liquid document
        const stylesheetString =
          Array(schemaLineNumber).fill('\n').join('') +
          stylesheetTag.source
            .slice(stylesheetTag.blockStartPosition.end, stylesheetTag.blockEndPosition.start)
            .replace(/\n$/, ''); // Remove trailing newline so parsing errors don't show up on `{% endstylesheet %}`
        const stylesheetTextDocument = TextDocument.create(
          textDocument.uri,
          'json',
          textDocument.version,
          stylesheetString,
        );
        const stylesheetDocument = service.parseStylesheet(stylesheetTextDocument);
        return [stylesheetTextDocument, stylesheetDocument];
      }
    }
  }
}
