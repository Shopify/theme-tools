import { TokenType, tokenize } from './tokenizer';
import type { Token, TokenizeOptions } from './tokenizer';
import type { RawBodyEnd } from '../tag-definitions';
import { LiquidHTMLASTParsingError } from '../errors';
import { Environment } from '../environment';

export class ParserBase {
  protected tokens: Token[];
  protected source: string;
  protected p: number;
  private rawBodyEnds?: readonly RawBodyEnd[];
  constructor(
    tokens: Token[],
    source: string,
    private readonly tokenizeOptions?: TokenizeOptions,
    rawBodyEnds?: readonly RawBodyEnd[],
  ) {
    this.tokens = tokens;
    this.source = source;
    this.p = 0;
    if (rawBodyEnds) this.rawBodyEnds = rawBodyEnds;
    if (tokenizeOptions?.rawTags) {
      this.rawTagVersion = tokenizeOptions.rawTags.tagRegistryVersion;
      this.inspectedRawBodyEnd = 0;
      this.rawTagValidUntil = source.length;
    }
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

  tokenAt(index: number): Token {
    return this.tokens[index];
  }

  isTolerant(): boolean {
    return false;
  }

  hasToken(index: number): boolean {
    return index < this.tokens.length;
  }

  tokenCount(): number {
    return this.tokens.length;
  }

  getPosition(): number {
    return this.p;
  }

  rawBodyEndFor(closeToken: Token): RawBodyEnd | undefined {
    if (this.tokens[this.p - 1] === closeToken) return this.rawBodyEnds?.[this.p - 1];
    return undefined;
  }

  setPosition(index: number): void {
    this.p = index;
  }

  /**
   * Move the cursor to the first token whose `start` is at or after
   * `sourceOffset`. Unlike a cached token index, a source offset is stable
   * across raw-boundary recovery (which renumbers token slots but preserves
   * offsets), and it is robust against a body parse that over-advances the
   * cursor past `sourceOffset` (e.g. a `{% if %}` block inside an HTML raw body
   * that consumes the element's close tag as text while seeking `{% endif %}`).
   * Callers that know a token boundary by offset should re-seek here rather than
   * trusting wherever a nested parse left the cursor.
   * Binary search avoids rescanning tokens after each independent raw body.
   */
  seekToSourceOffset(sourceOffset: number): void {
    if (
      this.tokens[this.p]?.start === sourceOffset &&
      this.tokens[this.p - 1]?.start !== sourceOffset
    )
      return;
    // An ordinary HTML close consists of an opener, name and closing `>`.
    if (
      this.tokens[this.p + 3]?.start === sourceOffset &&
      this.tokens[this.p + 2].start < sourceOffset
    ) {
      this.p += 3;
      return;
    }
    let low = 0;
    let high = this.tokens.length;

    while (low < high) {
      const middle = low + ((high - low) >>> 1);

      if (this.tokens[middle].start < sourceOffset) low = middle + 1;
      else high = middle;
    }

    this.p = low;
  }

  declare private inspectedRawBodyEnd: number;
  declare private rawTagVersion: number;
  declare private rawTagValidUntil: number;
  declare rawTextBound: number | undefined;

  /** Repair only when a parser callback changed the registry since tokenization. */
  ensureRawBoundary(bodyStart: number, bodyEnd: number): void {
    if (!this.tokenizeOptions?.rawTags) return;
    this.inspectedRawBodyEnd = Math.max(bodyEnd, this.inspectedRawBodyEnd);
    if (
      this.rawTagVersion === this.tokenizeOptions.rawTags.tagRegistryVersion &&
      bodyStart < this.rawTagValidUntil &&
      bodyEnd <= this.rawTagValidUntil
    )
      return;
    this.rawTagValidUntil = this.recoverRawBoundaries(bodyStart, bodyEnd);
    this.rawTagVersion = this.tokenizeOptions.rawTags.tagRegistryVersion;
  }

  /**
   * Re-tokenize the `<script>`/`<style>` body from `bodyStart` to `bodyEnd` as
   * raw text, with the close tag `bodyEnd`..`closeEnd` and the rest of the
   * source as a normal document.
   *
   * The body is tokenized on its own, so no Liquid mode in it can run past the
   * close tag. After the close tag the existing tokens are kept when the old
   * stream already resumed a normal document there, which is the case when its
   * `HtmlTagClose` ends exactly at `closeEnd`: a tag mode only pops back to the
   * document. Otherwise the rest of the source is tokenized again.
   *
   * This renumbers every token slot after `bodyStart`.
   * Callers must recompute any token index they cached, or re-seek by source
   * offset. Leaves the cursor at the first body token.
   */
  retokenizeRawText(bodyStart: number, bodyEnd: number, closeEnd: number): void {
    this.rawBodyEnds = undefined;
    // Custom callbacks may have changed the registry since the initial scan.
    const prefix = this.tokens.filter((token) => token.end <= bodyStart);
    const body = this.tokenizeSlice(bodyStart, bodyEnd, { rawText: true });
    const closeIndex = this.tokens.findIndex(
      (token) => token.type === TokenType.HtmlTagClose && token.end === closeEnd,
    );
    const resumes = closeIndex !== -1 && this.tokens[closeIndex + 1]?.start === closeEnd;
    const suffix = resumes
      ? [...this.tokenizeSlice(bodyEnd, closeEnd), ...this.tokens.slice(closeIndex + 1)]
      : this.tokenizeSlice(bodyEnd, this.source.length, {}, true);
    this.tokens = [...prefix, ...body, ...suffix];
    this.p = prefix.length;
  }

  // Tokens for `source[start, end)`, with offsets in the whole source. Drops the
  // slice's EndOfInput unless `withEnd` is set.
  private tokenizeSlice(
    start: number,
    end: number,
    options: TokenizeOptions = {},
    withEnd = false,
  ): Token[] {
    const tokens = tokenize(this.source.slice(start, end), {
      ...(this.tokenizeOptions ?? { rawTags: Environment.default(), parseHtml: true }),
      ...options,
      skipFrontmatter: true,
    });
    if (!withEnd) tokens.pop();
    for (const token of tokens) {
      token.start += start;
      token.end += start;
    }
    return tokens;
  }

  private recoverRawBoundaries(sourceOffset: number, bodyEnd: number): number {
    this.rawBodyEnds = undefined;
    this.seekToSourceOffset(sourceOffset);
    // Keep indices held by active ancestor parsers stable.
    const prefix = this.tokens.slice(0, this.p);
    // Replay only the current opener. Registrations cannot reinterpret the
    // parsed prefix, whose tokens still describe its enclosing HTML mode.
    let opener = prefix.length - 1;
    const openerType =
      prefix[opener]?.type === TokenType.HtmlTagClose
        ? TokenType.HtmlTagOpen
        : TokenType.LiquidTagOpen;
    while (opener > 0 && prefix[opener].type !== openerType) opener--;
    const kept = prefix.slice(0, opener);
    let insideHtmlTag = false;
    let insideHtmlComment = false;
    let insideQuotedAttribute: string | undefined;
    for (const token of kept) {
      if (token.type === TokenType.HtmlCommentOpen) insideHtmlComment = true;
      else if (token.type === TokenType.HtmlCommentClose) insideHtmlComment = false;
      if (
        token.type === TokenType.HtmlTagOpen ||
        token.type === TokenType.HtmlCloseTagOpen ||
        token.type === TokenType.HtmlDoctypeOpen
      )
        insideHtmlTag = true;
      else if (token.type === TokenType.HtmlTagClose || token.type === TokenType.HtmlSelfClose)
        insideHtmlTag = false;
      else if (token.type === TokenType.HtmlQuoteOpen)
        insideQuotedAttribute = this.source[token.start];
      else if (token.type === TokenType.HtmlQuoteClose) insideQuotedAttribute = undefined;
    }
    const rawText = this.rawTextBound !== undefined;
    const bound = Math.min(
      this.rawTextBound ?? this.source.length,
      this.inspectedRawBodyEnd > bodyEnd ? this.inspectedRawBodyEnd : this.source.length,
    );
    const start = prefix[opener]?.start ?? sourceOffset;
    this.tokens = kept.concat(
      this.tokenizeSlice(
        start,
        bound,
        {
          insideHtmlTag: !rawText && insideHtmlTag,
          insideQuotedAttribute: rawText ? undefined : insideQuotedAttribute,
          rawText,
          insideHtmlComment: !rawText && insideHtmlComment,
        },
        bound === this.source.length,
      ),
      bound === this.source.length ? [] : this.tokens.filter((token) => token.start >= bound),
    );
    this.seekToSourceOffset(sourceOffset);
    // A retained suffix still belongs to the previous registry version.
    return bound;
  }
}
