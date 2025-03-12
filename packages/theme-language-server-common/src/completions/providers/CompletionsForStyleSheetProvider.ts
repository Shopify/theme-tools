import { CompletionItem, TextDocument } from 'vscode-languageserver';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { getCssLanguageService } from '../../plugins/css';
import { offsetToPosition, positionToOffset } from '../../utils/position';

export class CompletionsForStyleSheetProvider implements Provider {
  constructor() {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node } = params.completionContext;
    const { document } = params;
    if (
      node &&
      document.stylesheet &&
      document.stylesheet.tagStart <= node.position.start &&
      document.stylesheet.tagEnd >= node.position.end
    ) {
      const cssLanguageService = getCssLanguageService('css');
      const offset = document.stylesheet.cssStart;
      const position = offsetToPosition(document.stylesheet.source, node.position.end - offset);
      const stylesheet = cssLanguageService.parseStylesheet(document.stylesheet.source);
      const completions = cssLanguageService.doComplete(
        document.stylesheet.source,
        position,
        stylesheet,
        { triggerPropertyValueCompletion: false, completePropertyWithSemicolon: true },
      );

      // @ts-expect-error
      return completions.items.map(x => ({
        ...x,
        textEdit: x.textEdit ? {
          ...x.textEdit,
          range: x.textEdit && 'range' in x.textEdit ? {
            start: offsetToPosition(document.stylesheet!.source, positionToOffset(document.stylesheet!.source, x.textEdit?.range?.start || 0) + offset),
            end: offsetToPosition(document.stylesheet!.source, positionToOffset(document.stylesheet!.source, x.textEdit?.range?.end || 0) + offset),
          } : null,
        } : undefined,
      }));
    } else {
      return [];
    }
  }
}
