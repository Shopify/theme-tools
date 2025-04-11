import {
  GetDocDefinitionForURI,
  MetafieldDefinitionMap,
  SourceCodeType,
  ThemeDocset,
} from '@shopify/theme-check-common';
import { CompletionItem, CompletionParams } from 'vscode-languageserver';
import { TypeSystem } from '../TypeSystem';
import { DocumentManager } from '../documents';
import { GetThemeSettingsSchemaForURI } from '../settings';
import { GetTranslationsForURI } from '../translations';
import { createLiquidCompletionParams } from './params';
import {
  ContentForCompletionProvider,
  ContentForBlockTypeCompletionProvider,
  ContentForParameterCompletionProvider,
  FilterCompletionProvider,
  FilterNamedParameterCompletionProvider,
  GetSnippetNamesForURI,
  HtmlAttributeCompletionProvider,
  HtmlAttributeValueCompletionProvider,
  HtmlTagCompletionProvider,
  LiquidDocParamTypeCompletionProvider,
  LiquidDocTagCompletionProvider,
  LiquidTagsCompletionProvider,
  ObjectAttributeCompletionProvider,
  ObjectCompletionProvider,
  Provider,
  RenderSnippetCompletionProvider,
  RenderSnippetParameterCompletionProvider,
  TranslationCompletionProvider,
} from './providers';

export interface CompletionProviderDependencies {
  documentManager: DocumentManager;
  themeDocset: ThemeDocset;
  getTranslationsForURI?: GetTranslationsForURI;
  getSnippetNamesForURI?: GetSnippetNamesForURI;
  getThemeSettingsSchemaForURI?: GetThemeSettingsSchemaForURI;
  getMetafieldDefinitions: (rootUri: string) => Promise<MetafieldDefinitionMap>;
  getDocDefinitionForURI?: GetDocDefinitionForURI;
  getThemeBlockNames?: (rootUri: string, includePrivate: boolean) => Promise<string[]>;
  log?: (message: string) => void;
}

export class CompletionsProvider {
  private providers: Provider[] = [];
  readonly documentManager: DocumentManager;
  readonly themeDocset: ThemeDocset;
  readonly log: (message: string) => void;

  constructor({
    documentManager,
    themeDocset,
    getMetafieldDefinitions,
    getTranslationsForURI = async () => ({}),
    getSnippetNamesForURI = async () => [],
    getThemeSettingsSchemaForURI = async () => [],
    getDocDefinitionForURI = async (uri, _relativePath) => ({ uri }),
    getThemeBlockNames = async (_rootUri: string, _includePrivate: boolean) => [],
    log = () => {},
  }: CompletionProviderDependencies) {
    this.documentManager = documentManager;
    this.themeDocset = themeDocset;
    this.log = log;
    const typeSystem = new TypeSystem(
      themeDocset,
      getThemeSettingsSchemaForURI,
      getMetafieldDefinitions,
    );

    this.providers = [
      new ContentForCompletionProvider(),
      new ContentForBlockTypeCompletionProvider(getThemeBlockNames),
      new ContentForParameterCompletionProvider(),
      new HtmlTagCompletionProvider(),
      new HtmlAttributeCompletionProvider(documentManager),
      new HtmlAttributeValueCompletionProvider(),
      new LiquidTagsCompletionProvider(themeDocset),
      new ObjectCompletionProvider(typeSystem),
      new ObjectAttributeCompletionProvider(typeSystem, getThemeSettingsSchemaForURI),
      new FilterCompletionProvider(typeSystem),
      new TranslationCompletionProvider(documentManager, getTranslationsForURI),
      new RenderSnippetCompletionProvider(getSnippetNamesForURI),
      new RenderSnippetParameterCompletionProvider(getDocDefinitionForURI),
      new FilterNamedParameterCompletionProvider(themeDocset),
      new LiquidDocTagCompletionProvider(),
      new LiquidDocParamTypeCompletionProvider(themeDocset),
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
