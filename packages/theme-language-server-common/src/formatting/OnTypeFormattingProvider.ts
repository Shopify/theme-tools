import { DocumentOnTypeFormattingParams } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { BracketsAutoclosingOnTypeFormattingProvider } from './providers/BracketsAutoclosingOnTypeFormattingProvider';
import { HtmlElementAutoclosingOnTypeFormattingProvider } from './providers/HtmlElementAutoclosingOnTypeFormattingProvider';
import { BaseOnTypeFormattingProvider, SetCursorPosition } from './types';

export class OnTypeFormattingProvider {
  private providers: BaseOnTypeFormattingProvider[];

  constructor(
    public documentManager: DocumentManager,
    public setCursorPosition: SetCursorPosition = async () => {},
  ) {
    this.providers = [
      new BracketsAutoclosingOnTypeFormattingProvider(),
      new HtmlElementAutoclosingOnTypeFormattingProvider(setCursorPosition),
    ];
  }

  async onTypeFormatting(params: DocumentOnTypeFormattingParams) {
    const document = this.documentManager.get(params.textDocument.uri);
    if (!document) return null;
    const results = this.providers.map((provider) => provider.onTypeFormatting(document, params));
    return results.find((result) => result !== null) ?? null;
  }
}
