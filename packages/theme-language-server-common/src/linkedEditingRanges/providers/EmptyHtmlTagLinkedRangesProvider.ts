import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import {
  LinkedEditingRangeParams,
  LinkedEditingRanges,
  Position,
  Range,
} from 'vscode-languageserver';
import { DocumentManager } from '../../documents';
import { BaseLinkedEditingRangesProvider } from '../BaseLinkedEditingRangesProvider';
import { htmlElementNameWordPattern } from '../wordPattern';

export class EmptyHtmlTagLinkedRangesProvider implements BaseLinkedEditingRangesProvider {
  constructor(public documentManager: DocumentManager) {}

  async linkedEditingRanges(
    node: LiquidHtmlNode | null,
    ancestors: LiquidHtmlNode[] | null,
    { textDocument: { uri }, position }: LinkedEditingRangeParams,
  ): Promise<LinkedEditingRanges | null> {
    // We're strictly checking for <></> and cursor in either branch. Ohm treated
    // this as a parse error (node/ancestors both null), but the ported parser now
    // parses <></> into real nodes, so we can no longer bail solely on non-null
    // node/ancestors. The source-text checks below (`<>`/`< ` and `</>`) are the
    // real discriminator and already return null for well-formed tags like
    // <div></div>, so we let them do the work instead.
    const document = this.documentManager.get(uri);
    const textDocument = document?.textDocument;

    if (!document || !textDocument) return null;
    const openRange = Range.create(
      Position.create(position.line, position.character - 1),
      Position.create(position.line, position.character + 1),
    );
    if (!['<>', '< '].includes(textDocument.getText(openRange))) return null;

    const closeOffset = document.source.indexOf('</>', textDocument.offsetAt(position));
    if (closeOffset === -1) return null;

    const afterSlashOffset = closeOffset + 2;
    const afterSlashPosition = textDocument.positionAt(afterSlashOffset);

    return {
      ranges: [
        Range.create(position, position),
        Range.create(afterSlashPosition, afterSlashPosition),
      ],
      wordPattern: htmlElementNameWordPattern,
    };
  }
}
