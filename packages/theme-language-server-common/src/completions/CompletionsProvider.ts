import { CompletionItem, CompletionParams } from 'vscode-languageserver';
import { SourceCodeType, ThemeDocset } from '@shopify/theme-check-common';
import {
  FilterCompletionProvider,
  LiquidTagsCompletionProvider,
  ObjectAttributeCompletionProvider,
  ObjectCompletionProvider,
  Provider,
} from './providers';
import { DocumentManager } from '../documents';
import { createLiquidCompletionParams } from './params';
import { TypeSystem } from './TypeSystem';

export class CompletionsProvider {
  private providers: Provider[] = [];

  constructor(
    readonly documentManager: DocumentManager,
    readonly themeDocset: ThemeDocset,
    readonly log: (message: string) => void = (_m: string) => {},
  ) {
    const typeSystem = new TypeSystem(themeDocset);

    this.providers = [
      new LiquidTagsCompletionProvider(themeDocset),
      new ObjectCompletionProvider(themeDocset),
      new ObjectAttributeCompletionProvider(typeSystem),
      new FilterCompletionProvider(themeDocset),
      // new HTMLTagsCompletionProvider(themeDocset),
      // new AssignmentsCompletionProvider(themeDocset),
      // new RenderSnippetCompletionProvider(themeDocset),
    ];
  }

  async completions(params: CompletionParams): Promise<CompletionItem[]> {
    const uri = params.textDocument.uri;
    const document = this.documentManager.get(uri);

    // Supports only Liquid resources
    if (document?.type !== SourceCodeType.LiquidHtml) {
      return [];
    }

    try {
      const liquidParams = createLiquidCompletionParams(document, params);
      const promises = this.providers.map((p) => p.completions(liquidParams));
      const results = await Promise.all(promises);
      return results.flat();
    } catch (err) {
      this.log(`[SERVER] CompletionsProvider error: ${err}`);
      return [];
    }
  }
}
