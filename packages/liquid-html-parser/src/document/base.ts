import { TokenType, createTokenizer } from './tokenizer';
import type { Token, Tokenizer } from './tokenizer';
import { LiquidHTMLASTParsingError } from '../errors';

export class ParserBase {
  protected tokens: Token[];
  protected source: string;
  protected p: number;
  /** Tokenizes the rest of the source as it's read, after a reslice. */
  private tokenizer: Tokenizer | undefined;
  /**
   * The HTML context the first `scanned` tokens leave open: the quote that
   * opened an attribute value, and whether a tag is open. See
   * `scanHtmlContext`.
   */
  private scanned = 0;
  private openQuote: Token | undefined;
  private openTag = false;
  constructor(tokens: Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
    this.p = 0;
  }

  consume(type: TokenType): Token {
    const token = this.tokenAt(this.p);
    if (token.type !== type) {
      throw new LiquidHTMLASTParsingError(
        `Expected ${type} but got ${token.type}`,
        this.source,
        token.start,
        token.end,
      );
    }
    this.p++;
    return token;
  }

  accept(type: TokenType): Token | null {
    if (this.tokenAt(this.p).type === type) {
      return this.tokens[this.p++];
    }
    return null;
  }

  check(type: TokenType, ahead: number = 0): boolean {
    const index = this.p + ahead;
    return this.hasToken(index) && this.tokens[index].type === type;
  }

  peek(): Token {
    return this.tokenAt(this.p);
  }

  advance(): Token {
    return this.tokenAt(this.p++);
  }

  isAtEnd(): boolean {
    return this.tokenAt(this.p).type === TokenType.EndOfInput;
  }

  getSource(): string {
    return this.source;
  }

  /**
   * Whether this document parse is tolerant. The strict/default parser returns
   * false; `TolerantDocumentParser` overrides it to true. Markup-construction
   * sites consult this to enable the markup parser's tolerant recovery axis
   * (`enableTolerant()`), leaving strict (and theme-check) parses untouched.
   * Disjoint from the render-tree lax axis.
   */
  isTolerant(): boolean {
    return false;
  }

  /** Whether there is a token at `index`, tokenizing up to it if need be. */
  hasToken(index: number): boolean {
    if (index >= this.tokens.length) this.tokenizer?.fill(index);
    return index < this.tokens.length;
  }

  tokenAt(index: number): Token {
    this.hasToken(index);
    return this.tokens[index];
  }

  getPosition(): number {
    return this.p;
  }

  setPosition(index: number): void {
    this.p = index;
  }

  /**
   * Move the cursor to the first token whose `start` is at or after
   * `sourceOffset`. Unlike a cached token index, a source offset is stable
   * across `resliceTokensFrom` (which renumbers token slots but preserves
   * offsets), and it is robust against a body parse that over-advances the
   * cursor past `sourceOffset` (e.g. a `{% if %}` block inside an HTML raw body
   * that consumes the element's close tag as text while seeking `{% endif %}`).
   * Callers that know a token boundary by offset should re-seek here rather than
   * trusting wherever a nested parse left the cursor.
   *
   * Token starts are non-decreasing (the tokenizer emits tokens in source
   * order and `resliceTokensFrom` keeps that order), so a binary search finds
   * the same token a scan from index 0 would, in O(log n), whichever side of
   * the cursor it is on. This runs once per HTML comment, raw element and raw
   * Liquid tag, so a linear scan here made parsing quadratic in the number of
   * those nodes.
   */
  seekToSourceOffset(sourceOffset: number): void {
    this.p = this.countTokensWhile((token) => token.start < sourceOffset);
  }

  /**
   * How many tokens, from the first, pass `test`, by binary search. Tokens are
   * in source order and don't overlap, so a test like "starts before" or "ends
   * at or before" an offset passes for a run of leading tokens and no others.
   */
  private countTokensWhile(test: (token: Token) => boolean): number {
    // Tokenize until a token fails the test, or the input runs out.
    while (this.tokens.length === 0 || test(this.tokens[this.tokens.length - 1])) {
      if (!this.hasToken(this.tokens.length)) break;
    }
    let lo = 0;
    let hi = this.tokens.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (test(this.tokens[mid])) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Bring the HTML context up to date with the first `count` tokens:
   *
   * - `openQuote` is the last `HtmlQuoteOpen` not yet balanced by an
   *   `HtmlQuoteClose`, an attribute value still open at the boundary;
   * - `openTag` is whether the last `HtmlTagOpen` (`<div`), `HtmlCloseTagOpen`
   *   (`</div`) or `HtmlDoctypeOpen` (`<!`) is not yet balanced by an
   *   `HtmlTagClose` (`>`) or `HtmlSelfClose` (`/>`).
   *
   * A reslice only replaces the tokens past its boundary, so the tokens
   * already scanned stay valid for a later reslice past them, which only has
   * to scan the tokens in between.
   */
  private scanHtmlContext(count: number): void {
    if (count < this.scanned) {
      this.scanned = 0;
      this.openQuote = undefined;
      this.openTag = false;
    }
    for (; this.scanned < count; this.scanned++) {
      const token = this.tokens[this.scanned];
      switch (token.type) {
        case TokenType.HtmlQuoteOpen:
          this.openQuote = token;
          break;
        case TokenType.HtmlQuoteClose:
          this.openQuote = undefined;
          break;
        case TokenType.HtmlTagOpen:
        case TokenType.HtmlCloseTagOpen:
        case TokenType.HtmlDoctypeOpen:
          this.openTag = true;
          break;
        case TokenType.HtmlTagClose:
        case TokenType.HtmlSelfClose:
          this.openTag = false;
          break;
      }
    }
  }

  /**
   * Re-tokenize the source from `sourceOffset` onward in place of the tokens
   * there, positioning the parser at the first of the new ones.
   *
   * This is needed after a raw-tag body is scanned at the source level
   * (see `liquid-raw.ts`): a stray `{{`/`{%` inside the raw body can open a
   * tokenizer mode that greedily runs *past* the real end tag, producing a
   * token that straddles the end-tag boundary and absorbs legitimate
   * post-end-tag content. Re-tokenizing the remainder from exactly the end
   * tag's end offset restores a clean token stream so content following the
   * raw block (e.g. a trailing `{{ 1 }}`) is parsed normally.
   *
   * Tokens that lie entirely before `sourceOffset` are retained as a prefix
   * (the parser only moves forward, so they are never revisited); every token
   * that starts at or straddles the boundary is replaced.
   *
   * The re-tokenize is gated on an actual straddle: only when a token starts
   * before `sourceOffset` and ends after it has the original stream been
   * corrupted by the body's stray `{{`/`{%`. When the boundary already falls
   * cleanly between tokens (e.g. `{% raw %}x{% endraw %}` with no stray opener),
   * the existing tokens past it are correct and carry context a fresh suffix
   * tokenize cannot reconstruct — an enclosing HTML attribute's closing quote
   * (`...{% endraw %}">`) or a mid-document `---` that is NOT frontmatter — so
   * we leave the stream untouched. Frontmatter is also suppressed in the
   * re-tokenize since the suffix never begins a document.
   */
  resliceTokensFrom(sourceOffset: number): void {
    // Tokens don't overlap, so only the first one ending past the boundary can
    // straddle it.
    const before = this.countTokensWhile((token) => token.end <= sourceOffset);
    const straddles = this.hasToken(before) && this.tokens[before].start < sourceOffset;

    if (straddles) {
      this.scanHtmlContext(before);
      // If the boundary lies inside a quoted HTML attribute value (the raw tag
      // was dispatched from `parseQuotedAttributeValue`), the suffix must be
      // re-tokenized in QuotedValue mode so the attribute's closing quote and
      // `>` emit as HtmlQuoteClose/HtmlTagClose instead of Text. A plain
      // document-start tokenize would drop that context and make
      // `parser.consume(HtmlQuoteClose)` throw. Recover the enclosing quote
      // char (if any) from the still-open quote in the retained prefix.
      const insideQuotedAttribute = this.openQuote && this.source[this.openQuote.start];
      // When the straddle lands in an unquoted attribute-list position (no
      // enclosing quote), resume in HtmlTag mode so the tag's closing `>` emits
      // as HtmlTagClose instead of Text. `insideQuotedAttribute` already nests
      // HtmlTag beneath QuotedValue, so this only applies when there is no quote.
      const insideHtmlTag = !insideQuotedAttribute && this.openTag;
      // Re-tokenize only as far as the parser reads: the next straddling raw
      // tag replaces the tokens past it again.
      this.tokens.length = before;
      this.tokenizer ??= createTokenizer(this.source, this.tokens);
      this.tokenizer.restart(sourceOffset, {
        skipFrontmatter: true,
        insideQuotedAttribute,
        insideHtmlTag,
      });
      this.p = before;
      return;
    }

    // No corruption: the existing tokens past the boundary are correct. Just
    // advance the cursor to the first token at/after `sourceOffset` — moving
    // past the raw end tag is the only thing the reslice needed to do here.
    // (The trailing EndOfInput token has `start === source.length`, so it is
    // never skipped past, keeping `this.p` in bounds.)
    this.seekToSourceOffset(sourceOffset);
  }
}
