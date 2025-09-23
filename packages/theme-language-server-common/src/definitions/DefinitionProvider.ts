import { findCurrentNode, SourceCodeType } from '@shopify/theme-check-common';
import { DefinitionLink, DefinitionParams } from 'vscode-languageserver';

import { AugmentedJsonSourceCode, DocumentManager } from '../documents';
import { BaseDefinitionProvider } from './BaseDefinitionProvider';
import { TranslationStringDefinitionProvider } from './providers/TranslationStringDefinitionProvider';

export class DefinitionProvider {
  private providers: BaseDefinitionProvider[];

  constructor(
    private documentManager: DocumentManager,
    getDefaultLocaleSourceCode: (uri: string) => Promise<AugmentedJsonSourceCode | null>,
  ) {
    this.providers = [
      new TranslationStringDefinitionProvider(documentManager, getDefaultLocaleSourceCode),
    ];
  }

  async definitions(params: DefinitionParams): Promise<DefinitionLink[] | null> {
    const sourceCode = this.documentManager.get(params.textDocument.uri);
    if (
      !sourceCode ||
      sourceCode.type !== SourceCodeType.LiquidHtml ||
      sourceCode.ast instanceof Error
    ) {
      return null;
    }

    const { textDocument } = sourceCode;
    const [node, ancestors] = findCurrentNode(
      sourceCode.ast,
      textDocument.offsetAt(params.position),
    );

    const results: DefinitionLink[] = await Promise.all(
      this.providers.map((provider) => provider.definitions(params, node, ancestors)),
    ).then((res) => res.flat());

    return results.length > 0 ? results : null;
  }
}
