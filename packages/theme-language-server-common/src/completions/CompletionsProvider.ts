import { SourceCodeType, ThemeDocset } from '@shopify/theme-check-common';
import { CompletionItem, CompletionParams } from 'vscode-languageserver';
import { TypeSystem } from '../TypeSystem';
import { DocumentManager } from '../documents';
import { createLiquidCompletionParams } from './params';
import {
  FilterCompletionProvider,
  HtmlAttributeCompletionProvider,
  HtmlAttributeValueCompletionProvider,
  HtmlTagCompletionProvider,
  LiquidTagsCompletionProvider,
  ObjectAttributeCompletionProvider,
  ObjectCompletionProvider,
  TranslationCompletionProvider,
  RenderSnippetCompletionProvider,
  Provider,
} from './providers';
import { GetTranslationsForURI } from '../translations';
import { GetSnippetNamesForURI } from './providers/RenderSnippetCompletionProvider';

export class CompletionsProvider {
  private providers: Provider[] = [];

  constructor(
    readonly documentManager: DocumentManager,
    readonly themeDocset: ThemeDocset,
    readonly getTranslationsForURI: GetTranslationsForURI = async () => ({}),
    readonly getSnippetNamesForURI: GetSnippetNamesForURI = async () => [],
    readonly log: (message: string) => void = (_m: string) => {},
  ) {
    const typeSystem = new TypeSystem(themeDocset);

    this.providers = [
      new HtmlTagCompletionProvider(),
      new HtmlAttributeCompletionProvider(),
      new HtmlAttributeValueCompletionProvider(),
      new LiquidTagsCompletionProvider(themeDocset),
      new ObjectCompletionProvider(typeSystem),
      new ObjectAttributeCompletionProvider(typeSystem),
      new FilterCompletionProvider(typeSystem),
      new TranslationCompletionProvider(documentManager, getTranslationsForURI),
      new RenderSnippetCompletionProvider(getSnippetNamesForURI),
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
