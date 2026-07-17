import { TokenType, tokenize } from './tokenizer';
import type { Token } from './tokenizer';
import { LiquidHTMLASTParsingError } from '../errors';

export class ParserBase {
  protected tokens: Token[];
  protected source: string;
  protected p: number;
  constructor(tokens: Token[], source: string) {
    this.tokens = tokens;
    this.source = source;
    this.p = 0;
  }

  consume(type: TokenType): Token {
    const token = this.tokens[this.p];
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
    if (this.tokens[this.p].type === type) {
      return this.tokens[this.p++];
    }
    return null;
  }

  check(type: TokenType, ahead: number = 0): boolean {
    const index = this.p + ahead;
    return index < this.tokens.length && this.tokens[index].type === type;
  }

  peek(): Token {
    return this.tokens[this.p];
  }

  advance(): Token {
    return this.tokens[this.p++];
  }

  isAtEnd(): boolean {
    return this.tokens[this.p].type === TokenType.EndOfInput;
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

  tokenAt(index: number): Token {
    return this.tokens[index];
  }

  tokenCount(): number {
    return this.tokens.length;
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
   */
  seekToSourceOffset(sourceOffset: number): void {
    let i = 0;
    while (i < this.tokens.length && this.tokens[i].start < sourceOffset) i++;
    this.p = i;
  }

  /**
   * Re-tokenize the source from `sourceOffset` onward and splice the fresh
   * tokens in, positioning the parser at the first of them.
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
  /**
   * If the given prefix tokens end inside an open HTML quoted attribute value,
   * return the quote character (`"` or `'`) that opened it; otherwise `undefined`.
   *
   * An attribute value is "open" at the prefix boundary when the last
   * `HtmlQuoteOpen` is not yet balanced by an `HtmlQuoteClose`. The quote char
   * is read from the source at the open token's position so single- and
   * double-quoted attributes are handled identically.
   */
  private openQuoteCharBefore(prefix: Token[]): string | undefined {
    let openQuote: Token | undefined;
    for (const token of prefix) {
      if (token.type === TokenType.HtmlQuoteOpen) openQuote = token;
      else if (token.type === TokenType.HtmlQuoteClose) openQuote = undefined;
    }
    return openQuote ? this.source[openQuote.start] : undefined;
  }

  /**
   * Whether the prefix tokens end inside an open HTML tag — an `HtmlTagOpen`
   * (`<div`), `HtmlCloseTagOpen` (`</div`), or `HtmlDoctypeOpen` (`<!`) that is
   * not yet balanced by an `HtmlTagClose` (`>`) or `HtmlSelfClose` (`/>`). Used
   * to resume a suffix re-tokenize in `HtmlTag` mode when a `{% raw %}` straddle
   * lands in an *unquoted* attribute-list position (no enclosing quote).
   */
  private insideOpenHtmlTag(prefix: Token[]): boolean {
    let open = false;
    for (const token of prefix) {
      if (
        token.type === TokenType.HtmlTagOpen ||
        token.type === TokenType.HtmlCloseTagOpen ||
        token.type === TokenType.HtmlDoctypeOpen
      ) {
        open = true;
      } else if (token.type === TokenType.HtmlTagClose || token.type === TokenType.HtmlSelfClose) {
        open = false;
      }
    }
    return open;
  }

  resliceTokensFrom(sourceOffset: number): void {
    const straddles = this.tokens.some(
      (token) => token.start < sourceOffset && token.end > sourceOffset,
    );

    if (straddles) {
      const prefix = this.tokens.filter((token) => token.end <= sourceOffset);
      // If the boundary lies inside a quoted HTML attribute value (the raw tag
      // was dispatched from `parseQuotedAttributeValue`), the suffix must be
      // re-tokenized in QuotedValue mode so the attribute's closing quote and
      // `>` emit as HtmlQuoteClose/HtmlTagClose instead of Text. A plain
      // document-start tokenize would drop that context and make
      // `parser.consume(HtmlQuoteClose)` throw. Recover the enclosing quote
      // char (if any) from the still-open quote in the retained prefix.
      const insideQuotedAttribute = this.openQuoteCharBefore(prefix);
      // When the straddle lands in an unquoted attribute-list position (no
      // enclosing quote), resume in HtmlTag mode so the tag's closing `>` emits
      // as HtmlTagClose instead of Text. `insideQuotedAttribute` already nests
      // HtmlTag beneath QuotedValue, so this only applies when there is no quote.
      const insideHtmlTag = !insideQuotedAttribute && this.insideOpenHtmlTag(prefix);
      const rebased = tokenize(this.source.slice(sourceOffset), {
        skipFrontmatter: true,
        insideQuotedAttribute,
        insideHtmlTag,
      }).map((token) => ({
        type: token.type,
        start: token.start + sourceOffset,
        end: token.end + sourceOffset,
      }));
      this.tokens = [...prefix, ...rebased];
      this.p = prefix.length;
      return;
    }

    // No corruption: the existing tokens past the boundary are correct. Just
    // advance the cursor to the first token at/after `sourceOffset` — moving
    // past the raw end tag is the only thing the reslice needed to do here.
    // (The trailing EndOfInput token has `start === source.length`, so it is
    // never skipped past, keeping `this.p` in bounds.)
    let i = 0;
    while (i < this.tokens.length && this.tokens[i].start < sourceOffset) i++;
    this.p = i;
  }
}
