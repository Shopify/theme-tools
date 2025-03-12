import { Hover, TextDocument, HoverParams } from 'vscode-languageserver';
import { BaseHoverProvider } from '../BaseHoverProvider';
import { getCssLanguageService } from '../../plugins/css';
import { Position } from 'vscode-json-languageservice';
import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { DocumentManager } from '../../documents';
import { positionToOffset } from '../../utils/position';
import { offsetToPosition } from '../../utils/position';

export class CssHoverProvider implements BaseHoverProvider {
  constructor(private documentManager: DocumentManager) {}

  async hover(
    currentNode: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
    params: HoverParams,
  ): Promise<Hover | null> {
    const node = currentNode;
    const document = this.documentManager.get(params.textDocument.uri);

    if (
      document &&
      node &&
      'stylesheet' in document &&
      document.stylesheet &&
      document.stylesheet.cssStart >= node.position.start &&
      document.stylesheet.cssEnd <= node.position.end
    ) {
      const cssLanguageService = getCssLanguageService('css');
      const offset = document.stylesheet.cssStart;
      const position = offsetToPosition(document.stylesheet.source, node.position.start - offset);
      const stylesheet = cssLanguageService.parseStylesheet(document.stylesheet.source);
      const information = cssLanguageService.doHover(
        document.stylesheet.source,
        position,
        stylesheet,
      );
      return information
        ? {
            contents: information.contents,
            range: information.range
              ? {
                  start: offsetToPosition(
                    document.stylesheet.source,
                    positionToOffset(document.stylesheet.source, information.range.start) + offset,
                  ),
                  end: offsetToPosition(
                    document.stylesheet.source,
                    positionToOffset(document.stylesheet.source, information.range.end) + offset,
                  ),
                }
              : undefined,
          }
        : null;
    } else {
      return null;
    }
  }
}
