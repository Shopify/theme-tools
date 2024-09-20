import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { BaseOnTypeFormattingProvider } from './types';
import { BracketsAutoclosingOnTypeFormattingProvider } from './providers/BracketsAutoclosingOnTypeFormattingProvider';

export class OnTypeFormattingProvider {
  private providers: BaseOnTypeFormattingProvider[];

  constructor(public documentManager: DocumentManager) {
    this.providers = [new BracketsAutoclosingOnTypeFormattingProvider()];
  }

  async onTypeFormatting(params: DocumentOnTypeFormattingParams) {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document) return null;
    const results = this.providers.map((provider) => provider.onTypeFormatting(document, params));
    return results.find((result) => result !== null) ?? null;
  }
}
