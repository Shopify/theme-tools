import { DocumentParser } from './parser';
import { TokenType } from './tokenizer';
import { NodeTypes } from '../types';
import { LiquidHTMLASTParsingError } from '../errors';
import type { LiquidErrorNode, LiquidHtmlNode } from '../ast';

/*
 * Token types that open a new top-level construct. Panic-mode recovery
 * resynchronizes onto one of these so the next `super.parseNode()` call
 * resumes on a real node boundary rather than mid-construct. EndOfInput is a
 * member so recovery always has a boundary to stop on.
 */
export const RESYNC_TOKENS: ReadonlySet<TokenType> = new Set([
  TokenType.LiquidTagOpen,
  TokenType.LiquidVariableOutputOpen,
  TokenType.HtmlTagOpen,
  TokenType.HtmlCloseTagOpen,
  TokenType.HtmlCommentOpen,
  TokenType.HtmlDoctypeOpen,
  TokenType.EndOfInput,
]);

/** Whether a token type opens a construct we can safely resume parsing on. */
export function isResyncToken(type: TokenType): boolean {
  return RESYNC_TOKENS.has(type);
}

/*
 * The readable name of a token type. TokenType is a string enum, so its value
 * is already the name; this indirection keeps the call sites self-documenting.
 */
export function tokenTypeName(type: TokenType): string {
  return type;
}

/*
 * Builds a LiquidErrorNode leaf covering a skipped region. Kept local to the
 * resilient path — deliberately not in the frozen factories.ts — so the
 * default parse has no way to construct it.
 */
export function makeLiquidErrorNode(
  start: number,
  end: number,
  source: string,
  message: string,
  found?: string,
): LiquidErrorNode {
  return {
    type: NodeTypes.LiquidErrorNode,
    position: { start, end },
    source,
    message,
    found,
  };
}

/*
 * Opt-in resilient parser. It behaves exactly like DocumentParser except that
 * a structural parse failure — which the default parser throws on, aborting the
 * whole parse — is caught here and turned into a LiquidErrorNode so parsing can
 * continue. The strict/default DocumentParser is a different class reached by a
 * different entry point and is left byte-identical.
 */
export class ResilientDocumentParser extends DocumentParser {
  /*
   * Wraps the polymorphic node parse. On a LiquidHTMLASTParsingError it emits a
   * LiquidErrorNode covering the skipped region and resynchronizes onto the next
   * construct-open boundary, so parsing continues and one document can surface
   * several errors interleaved with the constructs it did recover. A forced
   * >=1-token advance before the resync scan makes every recovery strictly
   * advance the cursor, which guarantees the parseDocument loop terminates.
   * Foreign (non-parse) errors are rethrown untouched.
   */
  parseNode(): LiquidHtmlNode {
    const startTok = this.peek();
    const startPos = this.getPosition();
    try {
      return super.parseNode();
    } catch (e) {
      if (!(e instanceof LiquidHTMLASTParsingError)) throw e;
      const source = this.getSource();
      const found = tokenTypeName(this.peek().type);
      /*
       * Guarantee at least one token of progress before scanning. A failed
       * parse can throw without having advanced the cursor (consume throws
       * before its own increment), and if the offending token is itself a
       * resync token the scan below would match it immediately and never move,
       * re-trapping parseDocument in an infinite loop. Forcing one advance
       * breaks that stall.
       */
      if (this.getPosition() <= startPos) this.advance();
      /*
       * Skip to the next construct-open boundary so the following
       * super.parseNode() resumes on a real node start rather than mid-
       * construct. isResyncToken includes EndOfInput, so this also stops
       * cleanly at the end of the source.
       */
      while (!this.isAtEnd() && !isResyncToken(this.peek().type)) this.advance();
      const end = this.peek().start;
      return makeLiquidErrorNode(startTok.start, end, source, e.message, found);
    }
  }
}
