import { createSystem } from '@typescript/vfs';
import { LiquidRawTag, NodeTypes } from '@shopify/liquid-html-parser';
import { AbstractFileSystem, Mode, Modes, SourceCodeType, findCurrentNode } from '@shopify/theme-check-common';
import ts, { LanguageService } from 'typescript';
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Diagnostic,
  DocumentDiagnosticParams,
  Hover,
  HoverParams,
  ClientCapabilities as LSPClientCapabilities,
  Position
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DocumentManager } from '../documents';
import { findJSConfig } from './utils';

export class JSLanguageService {
  private service: LanguageService | null = null;
  private snapshotManager: Map<string, ts.IScriptSnapshot> = new Map();
  private fileMap: Map<string, string> = new Map();

  constructor(private documentManager: DocumentManager) {}

  async setup(clientCapabilities: LSPClientCapabilities, fs: AbstractFileSystem, workspacePath: string) {
    console.log('test')
    let vfs: any | null = null;
    try {
      vfs = createSystem(this.fileMap);
    } catch (error) {
      console.error(error);
    }

    if (!vfs) {
      throw new Error('Failed to create VFS');
    }
    // TODO: we need to get fileExists to be synchronous
    const configPath = findJSConfig(workspacePath, [], () => true);
    let compilerOptions: ts.CompilerOptions;
    let compilerHost: ts.CompilerHost | null = null;

    if (configPath) {
      const projectConfig = JSON.parse(await fs.readFile(configPath));
      compilerOptions = projectConfig.compilerOptions;
    } else {
      compilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Node,
      }
    }
    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => compilerOptions,
      getScriptFileNames: () => Array.from(this.fileMap.keys()),
      fileExists: vfs.fileExists,
      readFile: vfs.readFile,
      readDirectory: vfs.readDirectory,
      // TODO: we need a snapshot manager
      getScriptVersion: (fileName: string) => '1',
      getScriptSnapshot: (fileName: string) =>
          this.snapshotManager.get(fileName) || ts.ScriptSnapshot.fromString(''),
      getCurrentDirectory: () => workspacePath,
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      getCompilerHost: () => compilerHost!
  };
    this.service = ts.createLanguageService(host);
  }

  async completions(params: CompletionParams): Promise<null | CompletionList | CompletionItem[]> {
    const service = this.service;
    if (!service) return null;
    const jsDocument = this.getDocuments(params, service);
    if (!jsDocument) return null;
    // TODO: convert position to offset
    const completions = await service.getCompletionsAtPosition(jsDocument.uri, positionToOffset(jsDocument, params.position), {});
    if (!completions) return null;
    // @ts-expect-error
    return completions;
  }

  async diagnostics(params: DocumentDiagnosticParams): Promise<Diagnostic[]> {
    const service = this.service;
    if (!service) return [];
    const jsDocument = this.getDocuments(params, service);
    if (!jsDocument) return [];
    // @ts-expect-error
    return service.getSemanticDiagnostics(jsDocument.uri);
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    const service = this.service;
    if (!service) return null;
    const jsDocument = this.getDocuments(params, service);
    if (!jsDocument) return null;
    const hover = await service.getQuickInfoAtPosition(jsDocument.uri, positionToOffset(jsDocument, params.position));
    if (!hover) return null;
    // @ts-expect-error
    return hover;
  }

  private getDocuments(
    params: HoverParams | CompletionParams | DocumentDiagnosticParams,
    service: LanguageService,
  ): TextDocument | null {
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
          const stylesheetIndex = document.source.indexOf('{% javascript %}');
          offset = stylesheetIndex;
          isDiagnostics = true;
        }
        const [node, ancestors] = findCurrentNode(document.ast, offset);
        let stylesheetTag = [...ancestors].find(
          (node): node is LiquidRawTag =>
            node.type === NodeTypes.LiquidRawTag && node.name === 'javascript',
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
        this.fileMap.set(textDocument.uri, stylesheetString);
        const program = this.service.getProgram();
        console.log(program?.getSourceFiles());
        return stylesheetTextDocument
      }
    }
  }
}

function positionToOffset(textDocument: TextDocument, position: Position): number {
  return textDocument.offsetAt(position);
}
