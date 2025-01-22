import { MetafieldDefinitionMap, SourceCodeType, ThemeDocset } from '@shopify/theme-check-common';
import { Hover, HoverParams } from 'vscode-languageserver';
import { TypeSystem } from '../TypeSystem';
import { DocumentManager } from '../documents';
import { GetTranslationsForURI } from '../translations';
import { BaseHoverProvider } from './BaseHoverProvider';
import {
  HtmlAttributeHoverProvider,
  HtmlTagHoverProvider,
  LiquidFilterHoverProvider,
  LiquidObjectAttributeHoverProvider,
  LiquidObjectHoverProvider,
  LiquidTagHoverProvider,
  TranslationHoverProvider,
  RenderSnippetHoverProvider,
} from './providers';
import { HtmlAttributeValueHoverProvider } from './providers/HtmlAttributeValueHoverProvider';
import { findCurrentNode } from '@shopify/theme-check-common';
import { GetThemeSettingsSchemaForURI } from '../settings';
import { GetSnippetDefinitionForURI } from '../liquidDoc';

export class HoverProvider {
  private providers: BaseHoverProvider[] = [];

  constructor(
    readonly documentManager: DocumentManager,
    readonly themeDocset: ThemeDocset,
    readonly getMetafieldDefinitions: (rootUri: string) => Promise<MetafieldDefinitionMap>,
    readonly getTranslationsForURI: GetTranslationsForURI = async () => ({}),
    readonly getSettingsSchemaForURI: GetThemeSettingsSchemaForURI = async () => [],
    readonly getSnippetDefinitionForURI: GetSnippetDefinitionForURI = async (
      _uri,
      snippetName,
    ) => ({
      name: snippetName,
    }),
  ) {
    const typeSystem = new TypeSystem(
      themeDocset,
      getSettingsSchemaForURI,
      getMetafieldDefinitions,
    );
    this.providers = [
      new LiquidTagHoverProvider(themeDocset),
      new LiquidFilterHoverProvider(themeDocset),
      new LiquidObjectHoverProvider(typeSystem),
      new LiquidObjectAttributeHoverProvider(typeSystem),
      new HtmlTagHoverProvider(),
      new HtmlAttributeHoverProvider(),
      new HtmlAttributeValueHoverProvider(),
      new TranslationHoverProvider(getTranslationsForURI, documentManager),
      new RenderSnippetHoverProvider(getSnippetDefinitionForURI),
    ];
  }

  async hover(params: HoverParams): Promise<Hover | null> {
    const uri = params.textDocument.uri;
    const document = this.documentManager.get(uri);

    // Supports only Liquid resources
    if (document?.type !== SourceCodeType.LiquidHtml || document.ast instanceof Error) {
      return null;
    }

    const [currentNode, ancestors] = findCurrentNode(
      document.ast,
      document.textDocument.offsetAt(params.position),
    );

    const promises = this.providers.map((p) => p.hover(currentNode, ancestors, params));
    const results = await Promise.all(promises);
    return results.find(Boolean) ?? null;
  }
}
