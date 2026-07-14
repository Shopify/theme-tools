import { LiquidHTMLASTParsingError } from '../errors';
import type {
  LiquidExpression,
  LiquidVariableLookup,
  BlockArrayLiteral,
  BlockArrayArgument,
  LiquidVariableLookupMode,
  LiquidConditionalExpression,
  ComplexLiquidExpression,
  LiquidVariable,
  LiquidFilter,
  LiquidArgument,
  LiquidNamedArgument,
} from '../ast';
import { LiquidLiteralValues } from '../ast';
import type { ValueExpression, Expression } from './expression-adapter';
import {
  LOGICAL_OPERATORS,
  EQUALITY_OPERATORS,
  COMPARISON_OPERATORS,
  type LogicalOperator,
  type EqualityOperator,
  type ComparisonOperator,
  adaptConditional,
  adaptComplex,
} from './expression-adapter';
import { NodeTypes } from '../types';
import { MarkupTokenType, tokenizeMarkup } from './tokenizer';
import type { MarkupToken } from './tokenizer';

export class MarkupParser {
  /**
   * Ruby's `VariableSegment = /[\w\-]/`; `VariableParser` scans `[\w-]+\??`
   * runs. Used by lax lookup recovery to read a glued segment (digits, leading
   * dashes) directly from source rather than relying on token types. Sticky so
   * it can be anchored with `lastIndex`.
   */
  private static readonly WORD_SEGMENT_RE = /[\w-]+\??/y;

  private tokens: MarkupToken[];
  private source: string;
  private p: number;
  private markupStart: number;
  private markupEnd: number;
  /**
   * When true, the parser performs Ruby-style lax recovery instead of throwing
   * on malformed markup. Defaults to false. This flag is NEVER set by the
   * document-layer parsers (so `toLiquidHtmlAST` and `theme-check` always parse
   * strictly); it is enabled exclusively by the render-tree's lax-recovery path
   * (`liquid-render-tree`) when it must reproduce Ruby's lax rendering of an
   * already-failed (string-markup) `{{ }}` or tag. See
   * `liquid-render-tree/src/lax-recover.ts`.
   */
  private lax: boolean;
  /**
   * True while parsing a condition (`if`/`unless`/`elsif`). In lax mode this
   * permits stripping meaningless grouping parens (`(false || true)`), which is
   * Ruby condition behavior. It must stay false in value contexts (`{{ }}`,
   * assign RHS) where a leading paren instead denotes a meaningless-paren
   * lookup that resolves to nil (`('X' | downcase)` → nil).
   */
  private inCondition: boolean;
  constructor(tokens: MarkupToken[], source: string, markupStart?: number, markupEnd?: number) {
    this.tokens = tokens;
    this.source = source;
    this.p = 0;
    // When markupStart/End are provided, bodyContext() uses them to return
    // the raw markup range including whitespace that the tokenizer skips.
    this.markupStart = markupStart ?? tokens[0]?.start ?? 0;
    this.markupEnd = markupEnd ?? this.computeLastTokenEnd();
    this.lax = false;
    this.inCondition = false;
  }

  /** Enables lax recovery for subsequent parse calls. Returns `this` for
   *  chaining. Only the render-tree lax-recovery path calls this. */
  enableLax(): this {
    this.lax = true;
    return this;
  }

  /** True when lax recovery is enabled. Tag parse callbacks consult this to add
   *  tag-specific recovery (e.g. numeric assign names) without affecting strict
   *  parsing. */
  isLax(): boolean {
    return this.lax;
  }

  /** Returns the raw source text from the current token up to (but excluding)
   *  the token whose type is `stop` (or end of markup), trimmed. Advances the
   *  cursor past everything consumed. Used by lax recovery to capture an
   *  invalid identifier (e.g. `123foo`) as a literal name. */
  consumeRawUntil(stop: MarkupTokenType): string {
    const start = this.peek().start;
    let end = start;
    while (!this.isAtEnd() && this.peek().type !== stop) {
      end = this.peek().end;
      this.p += 1;
    }
    return this.source.slice(start, end).trim();
  }

  /** Advances past every remaining token so isAtEnd() reports true. Used by lax
   *  recovery to "silently eat" residual garbage after a value has been parsed. */
  private discardRemaining(): void {
    while (!this.isAtEnd()) {
      this.p += 1;
    }
  }

  /** Public lax-only entry point to `discardRemaining()`. Tag parse callbacks
   *  (e.g. `whenBranchParse`) call this to drop a residual trailing element
   *  after a complete value, mirroring Ruby's lax fragment drop. No-op unless
   *  lax recovery is enabled, so strict parsing is unaffected (DD-7). */
  discardTrailing(): void {
    if (!this.lax) return;
    this.discardRemaining();
  }

  /** Lax helper: true when the current token can begin a value expression.
   *  Public so tag branch parsers (e.g. `whenBranchParse`) can peek whether a
   *  value follows a separator before consuming, to mirror Ruby dropping a
   *  trailing separator with no following value. */
  atValueStart(): boolean {
    switch (this.peek().type) {
      case MarkupTokenType.String:
      case MarkupTokenType.Number:
      case MarkupTokenType.Id:
      case MarkupTokenType.OpenSquare:
      case MarkupTokenType.OpenRound:
        return true;
      case MarkupTokenType.Dash:
        return this.lax;
      default:
        return false;
    }
  }

  /** Lax helper: true when the current token can begin a filter argument
   *  (a value or a named-argument key). */
  private atArgumentStart(): boolean {
    switch (this.peek().type) {
      case MarkupTokenType.String:
      case MarkupTokenType.Number:
      case MarkupTokenType.Id:
      case MarkupTokenType.OpenSquare:
      case MarkupTokenType.OpenRound:
        return true;
      default:
        return false;
    }
  }

  /** Lax helper: true when an upcoming `[` directly continues a variable lookup
   *  (`foo[0]`, `foo [0]`) rather than being a separate fragment split off by a
   *  dropped unknown operator (`foo ! [0]`). The tokenizer silently drops the
   *  operator characters it cannot tokenize (`!`, `~`, …), so a `[` the token
   *  stream places right after an identifier may actually be separated from it
   *  in the source by such an operator. Ruby's lax `if.rb` splits on that
   *  operator run and captures the bracket as its own (opaque) right fragment,
   *  so it must NOT be chained as bracket access — otherwise `foo ! [` parses as
   *  the lookup `foo[…]` and throws on the unterminated bracket instead of
   *  short-circuiting (`{% if false and foo ! [ %}…{% else %}NO{% endif %}` →
   *  `NO` in Ruby). A whitespace-only gap (`foo [0]`) is a genuine lookup in
   *  Ruby and stays chained. Strict mode never drops operator characters, so the
   *  token adjacency the strict grammar relies on is authoritative there. */
  private openSquareContinuesLookup(prevEnd: number, openSquare: MarkupToken): boolean {
    if (!this.lax) return true;
    return !/\S/.test(this.source.slice(prevEnd, openSquare.start));
  }

  /** Lax helper: advance the cursor to the next `|` separator (leaving it
   *  unconsumed) or to end-of-markup. Used by `filters()` to resync the filter
   *  chain after a malformed filter argument. */
  private skipToNextPipe(): void {
    while (!this.isAtEnd() && !this.look(MarkupTokenType.Pipe)) {
      this.p += 1;
    }
  }

  consume(type: MarkupTokenType): MarkupToken {
    const token = this.tokens[this.p];
    if (token.type !== type) {
      throw new LiquidHTMLASTParsingError(
        `Expected ${type} but found ${token.type} (${token.value})`,
        this.source,
        token.start,
        token.end,
      );
    }
    this.p += 1;
    return token;
  }

  consumeOptional(type: MarkupTokenType): MarkupToken | null {
    const token = this.tokens[this.p];
    if (token.type !== type) return null;
    this.p += 1;
    return token;
  }

  look(type: MarkupTokenType, ahead: number = 0): boolean {
    const index = this.p + ahead;
    if (index < 0 || index >= this.tokens.length) return false;
    return this.tokens[index].type === type;
  }

  peek(): MarkupToken {
    return this.tokens[this.p];
  }

  id(keyword: string): boolean {
    const token = this.tokens[this.p];
    if (token.type !== MarkupTokenType.Id || token.value !== keyword) return false;
    this.p += 1;
    return true;
  }

  isAtEnd(): boolean {
    return this.tokens[this.p].type === MarkupTokenType.EndOfString;
  }

  /** Returns the start position of the EndOfString sentinel token.
   *  This is the markup boundary — the position just past the last meaningful
   *  content, including any trailing whitespace before the closing delimiter. */
  eosStart(): number {
    return this.tokens[this.tokens.length - 1].start;
  }

  /** Returns the document source and byte range of the full markup string.
   *  Advances the parser to end-of-string so isAtEnd() returns true. */
  bodyContext(): { source: string; bodyStart: number; bodyEnd: number } {
    // Advance to end so callers that check isAtEnd() see we consumed everything
    while (!this.isAtEnd()) {
      this.p++;
    }
    return { source: this.source, bodyStart: this.markupStart, bodyEnd: this.markupEnd };
  }

  /** Returns the source text from the current token position to end of markup, trimmed. */
  remainingSource(): string {
    const current = this.tokens[this.p];
    if (current.type === MarkupTokenType.EndOfString) return '';
    const endToken = this.tokens[this.tokens.length - 1]; // EndOfString token
    return this.source.slice(current.start, endToken.start).trim();
  }

  // valueExpression := string | number | literal | variableLookup | range
  valueExpression(): ValueExpression {
    const token = this.peek();

    switch (token.type) {
      case MarkupTokenType.String: {
        this.p += 1;
        return {
          type: NodeTypes.String,
          single: token.value[0] === "'",
          value: token.value.slice(1, -1),
          position: { start: token.start, end: token.end },
          source: this.source,
        };
      }

      case MarkupTokenType.Number: {
        // Lax: a number immediately followed (no whitespace) by an identifier,
        // e.g. `123foo`, is an invalid variable name in Ruby lax mode that
        // resolves as a VariableLookup over the combined source rather than the
        // numeric literal `123`. The tokenizer splits it into Number + Id.
        if (this.lax) {
          const next = this.tokens[this.p + 1];
          if (next && next.type === MarkupTokenType.Id && next.start === token.end) {
            this.p += 2;
            return {
              type: NodeTypes.VariableLookup,
              name: this.source.slice(token.start, next.end),
              lookups: [],
              position: { start: token.start, end: next.end },
              source: this.source,
            };
          }
          // Lax: a number glued to a contiguous symbolic-operator-then-word run
          // (`1=>bar`) is not a number in Ruby — `Expression.parse("1=>bar")`
          // fails INTEGER_REGEX (`/\A-?\d+\z/`) and falls to
          // `VariableLookup.parse`, scanning `[\w-]+` runs → `1["bar"]`
          // (`expression.rb:40-46`). Route the number base through
          // `variableLookup()` so the lax separator fold runs and the `=>bar`
          // suffix becomes a `.lookup`, matching Ruby. Without this the bare
          // `Number` is returned and `discardTrailing()` drops `=>bar`. Strict
          // parsing never sets `lax` (DD-7).
          if (this.laxLookupSeparatorFollows(token.end)) {
            return this.variableLookup();
          }
        }
        this.p += 1;
        return {
          type: NodeTypes.Number,
          value: token.value,
          position: { start: token.start, end: token.end },
          source: this.source,
        };
      }

      case MarkupTokenType.Id: {
        // A keyword followed by a `[` that a dropped unknown operator separates
        // from it (`true ! [`) is NOT bracket access — keep it a literal so the
        // operator run is captured by comparison() rather than mis-parsing the
        // bracket as a lookup on the keyword (see openSquareContinuesLookup).
        const next = this.tokens[this.p + 1];
        const followedByBracketLookup =
          next?.type === MarkupTokenType.OpenSquare &&
          this.openSquareContinuesLookup(token.end, next);
        if (
          isLiteralKeyword(token.value) &&
          !this.look(MarkupTokenType.Dot, 1) &&
          !followedByBracketLookup &&
          // Lax: a literal keyword glued to a contiguous symbolic-operator-then-
          // word run (`true=>bar`) is not a literal in Ruby — `LITERALS` keys
          // are exact strings, so `Expression.parse("true=>bar")` misses the
          // `true` key and falls to `VariableLookup.parse` → `true["bar"]`
          // (`expression.rb:40-46`). Defer to `variableLookup()` so the lax
          // separator fold runs and the `=>bar` suffix becomes a `.lookup`,
          // matching Ruby. The literal fast-path stays for a bare literal with
          // no contiguous separator. Strict parsing never sets `lax` (DD-7).
          !(this.lax && this.laxLookupSeparatorFollows(token.end))
        ) {
          this.p += 1;
          return {
            type: NodeTypes.LiquidLiteral,
            keyword: token.value,
            value: LiquidLiteralValues[token.value],
            position: { start: token.start, end: token.end },
            source: this.source,
          };
        }
        return this.variableLookup();
      }

      case MarkupTokenType.OpenSquare:
        return this.variableLookup();

      case MarkupTokenType.Dot:
        // Lax: a leading-dot number (`.5`, `.4`) is not a numeric literal in
        // Ruby — `Expression.parse_number(".5")` fails (first byte is `.`), so
        // it falls to `VariableLookup.parse(".5")`. Ruby's `VariableParser`
        // scans `VariableSegment = [\w\-]` chars, which skips the leading dot
        // and yields the digit segment as the lookup name (`.5` → name `"5"`).
        // We mirror that here: `Dot` immediately followed (no whitespace) by a
        // `Number` becomes a `VariableLookup` named with the number's first
        // dot-delimited segment. This is lax-only so strict `toLiquidHtmlAST`
        // output (and the theme-check linter) is unchanged (DD-7).
        if (this.lax) {
          const next = this.tokens[this.p + 1];
          if (next && next.type === MarkupTokenType.Number && next.start === token.end) {
            // `VariableSegment` does not include `.`, so a multi-dot number
            // value (`5.5`) scans as name `5` plus a sub-lookup; take the
            // leading dot-delimited segment.
            let segment = next.value.split('.')[0];
            let end = next.end;
            let consumed = 2;
            // Ruby's `VariableParser` scans the whole `VariableSegment` run
            // (`[\w-]+`) after the leading dot, but the tokenizer fragments such
            // a run that begins with a digit into separate pieces — e.g. `.5foo`
            // → `Dot, Number("5"), Id("foo")` and `.5-foo` → `Dot, Number("5"),
            // Dash("-"), Id("foo")`. Re-join every contiguous `Id`/`Dash`/dot-
            // free `Number` fragment so the recovered name is the full run
            // (`5foo`, `5-foo`, `5-5`), not just the leading digit. Stops at the
            // first whitespace gap or non-`[\w-]` token (a `.` begins a separate
            // lookup, matching Ruby). Skipped when the number carried its own
            // dot (the segment already ended there).
            if (!next.value.includes('.')) {
              let after = this.tokens[this.p + consumed];
              while (
                after &&
                after.start === end &&
                !after.value.includes('.') &&
                (after.type === MarkupTokenType.Id ||
                  after.type === MarkupTokenType.Dash ||
                  after.type === MarkupTokenType.Number)
              ) {
                segment += after.value;
                end = after.end;
                consumed += 1;
                after = this.tokens[this.p + consumed];
              }
            }
            this.p += consumed;
            return {
              type: NodeTypes.VariableLookup,
              name: segment,
              lookups: [],
              position: { start: token.start, end },
              source: this.source,
            };
          }
        }
        throw new LiquidHTMLASTParsingError(
          `Expected expression but found ${token.type} (${token.value})`,
          this.source,
          token.start,
          token.end,
        );

      case MarkupTokenType.OpenRound: {
        const openToken = this.consume(MarkupTokenType.OpenRound);
        // Lax: "meaningless parens" — `('X' | downcase)` and similar that are
        // NOT a range (no `..`) resolve to nil in Ruby. Capture the raw paren
        // body as an (unresolvable) VariableLookup name and discard the rest.
        if (this.lax && !this.parenContainsRange()) {
          const raw = this.consumeRawUntil(MarkupTokenType.CloseRound);
          this.consumeOptional(MarkupTokenType.CloseRound);
          this.discardRemaining();
          return {
            type: NodeTypes.VariableLookup,
            name: raw,
            lookups: [],
            position: { start: openToken.start, end: this.eosStart() },
            source: this.source,
          };
        }
        const start = this.valueExpression();
        this.consume(MarkupTokenType.DotDot);
        // Lax: Ruby's RANGES_REGEX tolerates extra dots, e.g. `(1...5)` and
        // `(1.....5)` both parse as the range 1..5. Skip any surplus Dot/DotDot.
        if (this.lax) {
          while (this.look(MarkupTokenType.Dot) || this.look(MarkupTokenType.DotDot)) {
            this.p += 1;
          }
        }
        const end = this.valueExpression();
        // Lax: a missing closing paren is tolerated.
        const closeToken = this.lax
          ? this.consumeOptional(MarkupTokenType.CloseRound)
          : this.consume(MarkupTokenType.CloseRound);
        const rangeEnd = closeToken ? closeToken.end : end.position.end;
        return {
          type: NodeTypes.Range,
          start,
          end,
          position: { start: openToken.start, end: rangeEnd },
          source: this.source,
        };
      }

      case MarkupTokenType.Dash:
        // Lax: a bare `-` (e.g. `{{ - }}` or `assign foo = -`) is a
        // VariableLookup named "-" in Ruby (LITERALS has no entry, so it falls
        // through to a lookup which resolves to nil).
        if (this.lax) {
          this.p += 1;
          return {
            type: NodeTypes.VariableLookup,
            name: '-',
            lookups: [],
            position: { start: token.start, end: token.end },
            source: this.source,
          };
        }
        throw new LiquidHTMLASTParsingError(
          `Expected expression but found ${token.type} (${token.value})`,
          this.source,
          token.start,
          token.end,
        );

      default:
        throw new LiquidHTMLASTParsingError(
          `Expected expression but found ${token.type} (${token.value})`,
          this.source,
          token.start,
          token.end,
        );
    }
  }

  /** Lax helper: scan from the current position (just past an OpenRound) to the
   *  matching CloseRound and report whether a `..` range separator appears at
   *  the same paren depth. Distinguishes a real range `(1..5)` from meaningless
   *  parens `('X' | downcase)`. Does not advance the cursor. */
  private parenContainsRange(): boolean {
    let depth = 0;
    for (let i = this.p; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === MarkupTokenType.EndOfString) break;
      if (t.type === MarkupTokenType.OpenRound) depth += 1;
      else if (t.type === MarkupTokenType.CloseRound) {
        if (depth === 0) break;
        depth -= 1;
      } else if (t.type === MarkupTokenType.DotDot && depth === 0) {
        return true;
      }
    }
    return false;
  }

  // variableLookup := (id | "[" valueExpression "]") ("." id | "[" valueExpression "]")*
  variableLookup(): LiquidVariableLookup {
    let name: string | null;
    let startPos: number;

    const current = this.peek();
    if (current.type === MarkupTokenType.Id) {
      const token = this.consume(MarkupTokenType.Id);
      name = token.value;
      startPos = token.start;
    } else if (current.type === MarkupTokenType.OpenSquare) {
      name = null;
      startPos = current.start;
    } else if (
      this.lax &&
      current.type === MarkupTokenType.Number &&
      this.laxLookupSeparatorFollows(current.end)
    ) {
      // Lax: a bare number routed here by `valueExpression()` because a
      // contiguous `=>bar` follows (`1=>bar`). Ruby's `VariableLookup.parse`
      // scans `[\w-]+` runs, so the number's source text is the lookup base name
      // (`1["bar"]`). Take it as the name and let the lax separator fold below
      // absorb the `=>bar` suffix. Lax-only (DD-7).
      this.p += 1;
      name = current.value;
      startPos = current.start;
    } else {
      throw new LiquidHTMLASTParsingError(
        `Expected identifier or [ but found ${current.type} (${current.value})`,
        this.source,
        current.start,
        current.end,
      );
    }

    const lookups: LiquidExpression[] = [];
    // Parallel to `lookups`: marks each segment as a bareword (`.first`) vs a
    // bracket subscript (`["first"]`). Additive — see `LiquidVariableLookup`.
    const lookupModes: LiquidVariableLookupMode[] = [];
    let endPos = name !== null ? this.tokens[this.p - 1].end : startPos;
    let laxSegment: { value: string; start: number; end: number } | null = null;

    while (!this.isAtEnd()) {
      if (this.consumeOptional(MarkupTokenType.Dot)) {
        const prop = this.consume(MarkupTokenType.Id);
        lookups.push({
          type: NodeTypes.String,
          value: prop.value,
          position: { start: prop.start, end: prop.end },
          source: this.source,
        } as LiquidExpression);
        lookupModes.push('bareword');
        endPos = prop.end;
      } else if (
        this.look(MarkupTokenType.OpenSquare) &&
        this.openSquareContinuesLookup(endPos, this.peek())
      ) {
        this.consume(MarkupTokenType.OpenSquare);
        const inner = this.valueExpression();
        // Lax: a missing closing bracket (`['foo'`, `[['BIG']]`) is tolerated.
        const close = this.lax
          ? this.consumeOptional(MarkupTokenType.CloseSquare)
          : this.consume(MarkupTokenType.CloseSquare);
        lookups.push(inner);
        lookupModes.push('subscript');
        endPos = close ? close.end : inner.position.end;
        // Lax: if the bracket was unclosed there is nothing more to chain.
        if (
          this.lax &&
          !close &&
          !this.look(MarkupTokenType.Dot) &&
          !this.look(MarkupTokenType.OpenSquare)
        ) {
          break;
        }
      } else if (
        this.lax &&
        !this.inCondition &&
        (laxSegment = this.tryConsumeLaxLookupSeparator(endPos))
      ) {
        // Gated to VALUE contexts (`!inCondition`): this mirrors Ruby's
        // QuotedFragment lookup-folding, which only applies where Ruby scans a
        // bare value (`when` values, `{{ output }}`). In a CONDITION (`if`/
        // `elsif`/`unless`), Ruby parses operators normally, so contiguous
        // comparison punctuation must be left for `comparison()` — e.g. a lax
        // recovery of `foo==bar baz` must yield `foo == bar` (with `baz` dropped
        // as trailing garbage), NOT fold `==bar` into the lookup `foo["bar"]`.
        // `inCondition` is set only by `conditionalExpression()`; `when` values
        // parse via `valueExpression()` directly, so this gate preserves the
        // `when foo=>bar` recovery below while keeping condition parity intact.
        //
        // Lax: Ruby tokenizes a value as a single space-free QuotedFragment, then
        // `VariableParser` (`/#{VariableSegment}+\??/`, VariableSegment = `[\w\-]`)
        // scans the contiguous `[\w-]+` runs as name/lookup segments, silently
        // skipping any interleaved non-word punctuation. So `foo=>bar` parses to
        // the lookup `foo.bar` (name=foo, lookups=["bar"]) and resolves to
        // `foo["bar"]` (`variable_lookup.rb:14`, `case.rb:99-105/132-143`). The JS
        // tokenizer splits `foo=>bar` into `Id(foo) Equality(=) Comparison(>)
        // Id(bar)`, so `valueExpression`/`variableLookup` stops at `=>`, leaving
        // `=>bar` and forcing the document layer's raw-string fallback. Mirror
        // Ruby only on the lax render path: when the residual punctuation is
        // CONTIGUOUS (no whitespace gap — same QuotedFragment) and is followed by
        // a contiguous identifier, absorb that identifier as a `.lookup` segment.
        // A whitespace gap ends the fragment (`when 1 bar` → `[1]`, `bar` dropped),
        // so contiguity is the gate. Strict parsing never reaches here (`lax` is
        // only set by the render-tree lax-recovery path — DD-7), so the strict AST
        // / theme-check output is unchanged. The segment may contain digits or a
        // leading dash (`foo=>123` → `foo["123"]`, `foo=>-bar` → `foo["-bar"]`),
        // matching Ruby's `[\w-]` VariableSegment; `tryConsumeLaxLookupSeparator`
        // reads it from source and has already advanced the cursor past it.
        lookups.push({
          type: NodeTypes.String,
          value: laxSegment.value,
          position: { start: laxSegment.start, end: laxSegment.end },
          source: this.source,
        } as LiquidExpression);
        // Ruby scans `foo=>bar` as the bareword lookup `foo.bar`, so this
        // absorbed segment is a bareword segment.
        lookupModes.push('bareword');
        endPos = laxSegment.end;
      } else {
        break;
      }
    }

    // Lax: a doubly-bracketed lookup with no base name — `[['BIG']]` →
    // name=null, lookups=[VariableLookup(name="BIG")] — flattens in Ruby to a
    // single resolution of the inner name. Hoist the inner lookup so the
    // render-tree resolves `BIG` once rather than nesting.
    if (
      this.lax &&
      name === null &&
      lookups.length === 1 &&
      lookups[0].type === NodeTypes.VariableLookup &&
      lookups[0].name === null &&
      lookups[0].lookups.length === 1
    ) {
      const innerMode = lookups[0].lookupModes?.[0];
      return {
        type: NodeTypes.VariableLookup,
        name: null,
        lookups: [lookups[0].lookups[0]],
        lookupModes: innerMode ? [innerMode] : ['subscript'],
        position: { start: startPos, end: endPos },
        source: this.source,
      };
    }

    return {
      type: NodeTypes.VariableLookup,
      name,
      lookups,
      lookupModes,
      position: { start: startPos, end: endPos },
      source: this.source,
    };
  }

  /**
   * Lax helper for `variableLookup()`. Mirrors Ruby's `VariableParser` scanning
   * `[\w\-]+` runs out of a single space-free `QuotedFragment`, silently
   * skipping interleaved non-word punctuation (e.g. `foo=>bar` → lookups
   * `foo`/`bar`). Returns the recovered segment (value + source range, advancing
   * the cursor past every token the run covers) iff, starting at `prevEnd`, a
   * CONTIGUOUS run of non-word punctuation (`=`/`>`/`<`/`!`) is immediately
   * followed by a CONTIGUOUS `[\w-]+` segment — all with NO whitespace gap (a
   * whitespace gap ends the QuotedFragment, so the trailing word is a separate
   * fragment and is dropped). Otherwise returns null.
   *
   * The segment is read directly from `this.source` rather than from a single
   * trailing token, because Ruby's `VariableSegment = [\w\-]` treats digits and
   * `-` as word characters: `foo=>123` → `foo["123"]` and `foo=>-bar` →
   * `foo["-bar"]`. The JS tokenizer instead splits those into `Number` and
   * leading-`Dash` tokens, so matching token types alone would drop the numeric
   * segment and strip the leading dash. Scanning the raw `[\w-]+\??` run keeps
   * full Ruby parity. Tokens that are real value/list/filter separators (`.`
   * `[` `,` `|` `:` `..` `or`/`and`, spaced operators) are never crossed.
   * Lax-only; never reached by strict parsing (DD-7), so the strict AST is
   * unchanged.
   */
  private tryConsumeLaxLookupSeparator(
    prevEnd: number,
  ): { value: string; start: number; end: number } | null {
    let i = this.p;
    let expectedStart = prevEnd;
    // Skip a contiguous run of NON-WORD punctuation tokens (no whitespace
    // between them or the preceding lookup). `Dot`/`OpenSquare` are handled by
    // the caller and must not be crossed here; `Comma`/`Pipe`/`Colon` are
    // list/filter separators and end the fragment. `Dash` is NOT skipped here —
    // it is a word character in Ruby's `[\w-]` and is absorbed into the segment
    // run below (e.g. the leading `-` of `-bar`).
    while (i < this.tokens.length) {
      const tok = this.tokens[i];
      if (tok.type === MarkupTokenType.EndOfString) return null;
      if (tok.start !== expectedStart) return null; // whitespace gap → fragment ended
      // Punctuation glued to the lookup with no space (`=`/`>`/`<`/`!`) is part
      // of the same QuotedFragment in Ruby, scanned over by VariableParser. Any
      // other token type (a word-segment start such as Id/Number/Dash, or an
      // unabsorbable separator like Dot/OpenSquare/Comma) ends the skip.
      //
      // The bare word `contains` is tokenized as `Comparison` (tokenizer.ts),
      // but it is a `[\w-]+` word segment, not symbolic punctuation. Skipping it
      // here would consume the very segment we are trying to recover (`foo=>contains`
      // → `foo["contains"]`), so only cross tokens whose source text is composed
      // entirely of the symbolic operator chars `= < > !`.
      const isSymbolicOperator =
        (tok.type === MarkupTokenType.Equality || tok.type === MarkupTokenType.Comparison) &&
        /^[=<>!]+$/.test(tok.value);
      if (!isSymbolicOperator) {
        break;
      }
      expectedStart = tok.end;
      i += 1;
    }
    if (i === this.p) return null; // no non-word punctuation was skipped; nothing to recover
    // Read the contiguous `[\w-]+\??` run from source at `expectedStart`,
    // matching Ruby's VariableSegment scan. No whitespace gap is allowed.
    MarkupParser.WORD_SEGMENT_RE.lastIndex = expectedStart;
    const match = MarkupParser.WORD_SEGMENT_RE.exec(this.source);
    if (!match || match.index !== expectedStart) return null;
    const value = match[0];
    const end = expectedStart + value.length;
    // Advance the cursor past every real token fully covered by the run so the
    // caller's loop resumes after the absorbed segment. Stop at the synthetic
    // zero-width EndOfString sentinel so `isAtEnd()` still reads a valid token.
    let j = i;
    while (
      j < this.tokens.length &&
      this.tokens[j].type !== MarkupTokenType.EndOfString &&
      this.tokens[j].start >= expectedStart &&
      this.tokens[j].end <= end
    ) {
      j += 1;
    }
    this.p = j;
    return { value, start: expectedStart, end };
  }

  /**
   * Lax look-ahead for `valueExpression()`: reports whether, starting
   * immediately after `prevEnd` (the end of a just-peeked literal/number base),
   * a contiguous symbolic-operator run (`=`/`>`/`<`/`!`) follows with no
   * whitespace gap. In a CONDITION the run must also be followed by a contiguous
   * `[\w-]+` segment (the shape `tryConsumeLaxLookupSeparator` would absorb); in
   * a VALUE context the operator run alone suffices (see below). Does NOT advance
   * the cursor.
   *
   * Used to decide whether a literal keyword (`true=>bar`) or a bare number
   * (`1=>bar`) should be routed through `variableLookup()` so the contiguous
   * `=>bar` suffix folds into a lookup base (`true["bar"]` / `1["bar"]`),
   * matching Ruby's `Expression.parse` falling through to `VariableLookup.parse`
   * (`expression.rb:40-46`) instead of returning the bare literal/number. Without
   * this, `valueExpression()` returns the literal directly without ever entering
   * `variableLookup()`, so the lax fold never runs and the suffix is dropped by
   * `discardTrailing()`. The same routing also covers a DANGLING operator run
   * with no trailing word (`true=>`, `1<`) in a value context, which Ruby still
   * resolves to a `VariableLookup` with empty lookups (→ nil). Lax-only; never
   * reached by strict parsing (DD-7).
   */
  private laxLookupSeparatorFollows(prevEnd: number): boolean {
    // Scan from the token AFTER the base (the literal/number is still at
    // `this.p` and has not been consumed yet, unlike `tryConsumeLaxLookupSeparator`
    // which the caller invokes once the base lookup is already consumed).
    const startIndex = this.p + 1;
    let i = startIndex;
    let expectedStart = prevEnd;
    while (i < this.tokens.length) {
      const tok = this.tokens[i];
      // End-of-input or a whitespace gap ends the run. These `break` (not
      // `return false`) so a dangling operator run that reaches them — `true=>`,
      // `1<` at end of the fragment — still falls through to the value-context
      // check below; in a condition the trailing-word requirement (also below)
      // turns the same shapes back into `false`, unchanged.
      if (tok.type === MarkupTokenType.EndOfString) break;
      if (tok.start !== expectedStart) break; // whitespace gap → fragment ended
      const isSymbolicOperator =
        (tok.type === MarkupTokenType.Equality || tok.type === MarkupTokenType.Comparison) &&
        /^[=<>!]+$/.test(tok.value);
      if (!isSymbolicOperator) break;
      expectedStart = tok.end;
      i += 1;
    }
    if (i === startIndex) return false; // no symbolic-operator run skipped
    // In a VALUE context (a `when` value, filter argument, assign RHS) a
    // dangling symbolic-operator run with no trailing word (`true=>`, `1<`) is
    // still not a literal/number in Ruby: `Expression.parse` misses the
    // `LITERALS` key / fails `INTEGER_REGEX` and falls to `VariableLookup.parse`,
    // which yields name `"true"`/`"1"` with EMPTY lookups → nil → no match. So
    // the operator run alone is enough to route the base through
    // `variableLookup()`. In a CONDITION the left operand keeps its node shape
    // (a trailing word is still required) so the lax unknown-operator-run path
    // in `comparison()` — and the deferred lax-unknown-operator condition gap —
    // are left byte-for-byte unchanged.
    if (!this.inCondition) return true;
    MarkupParser.WORD_SEGMENT_RE.lastIndex = expectedStart;
    const match = MarkupParser.WORD_SEGMENT_RE.exec(this.source);
    return !!match && match.index === expectedStart;
  }

  // comparison := valueExpression (comparisonOp valueExpression)?
  comparison(): Expression {
    // Lax: in a condition, leading parens that are not a range (`(false)`,
    // `(false || true)`) are meaningless grouping wrappers — skip them. In a
    // value context a leading paren is handled by valueExpression() as a
    // meaningless-paren lookup instead, so only strip here for conditions.
    if (this.lax && this.inCondition) this.skipLaxConditionParens();
    const left = this.valueExpression();
    const token = this.peek();

    // Lax condition: capture an unknown operator the way Ruby does — the
    // contiguous `[=!<>a-z_]+` run in the raw source after the left operand
    // (`if.rb` Syntax). A multi-token garbage operator (`=!`, `===`, `<foo`) is
    // preserved IN FULL so evaluation raises `Unknown operator <run>` verbatim
    // (`condition.rb`), not the single tokenizer token (`=`) the lexer surfaces.
    // Logical joiners (`and`/`or`, also in the class) are left for
    // logicalExpr(). A run that is exactly a supported operator (`==`, `<`,
    // `contains`, …) falls through to the normal comparison path below. An
    // empty run — the next non-space character lies outside the class, e.g.
    // `true && false` / `true &= false` (the tokenizer drops `&`) or `true
    // TRUE` (uppercase) — means no operator, so the bare left operand stands.
    if (this.lax && this.inCondition && token.type !== MarkupTokenType.Logical) {
      const opRun = this.laxConditionOperatorRun(left.position.end);
      if (opRun && !isComparisonOp(opRun.value)) {
        return this.unknownOperatorComparison(left, opRun);
      }
      // Merged KNOWN operator: the raw run is a supported word operator
      // (`contains`) but the tokenizer fused it with the adjacent characters
      // into a single Id token (`ID_RE = /[a-zA-Z_][\w-]*\??/` matches
      // `contains0` whole), so the operator never surfaced as its own
      // Comparison/Equality token. Without this branch the run-is-known check
      // passes, the normal-comparison path below sees a non-operator next token
      // and returns the bare left operand — silently reducing the condition to
      // left-truthiness. Ruby instead captures `(op)\s*(rest)` via `if.rb`'s
      // lax `Syntax` (`arr contains0` → left `arr`, op `contains`, right `0`)
      // and evaluates it normally. Reconstruct that from the raw run so JS
      // matches (`{% if arr contains0 %}` → `arr contains 0`, not bare `arr`).
      if (
        opRun &&
        isComparisonOp(opRun.value) &&
        token.type !== MarkupTokenType.Comparison &&
        token.type !== MarkupTokenType.Equality
      ) {
        return this.mergedOperatorComparison(left, opRun);
      }
    }

    if (token.type !== MarkupTokenType.Comparison && token.type !== MarkupTokenType.Equality) {
      // Lax: drop a stray trailing close paren left by skipLaxConditionParens.
      if (this.lax) this.consumeOptional(MarkupTokenType.CloseRound);
      return left;
    }

    if (!isComparisonOp(token.value)) {
      // In lax + condition the raw-run check above already captured any unknown
      // operator, so this is unreachable there. A lax value context ends at the
      // left operand (`{{ false = }}` → `false`); strict mode raises.
      if (this.lax) return left;
      throw new LiquidHTMLASTParsingError(
        `Unknown operator ${token.value}`,
        this.source,
        token.start,
        token.end,
      );
    }

    this.p += 1;
    // Lax: a comparator with no following value (`false <`) ends at the left
    // operand rather than raising on the missing right-hand side.
    if (this.lax && !this.atValueStart()) {
      return left;
    }
    const right = this.valueExpression();

    // Lax: drop a stray trailing close paren after the comparison.
    if (this.lax) this.consumeOptional(MarkupTokenType.CloseRound);

    return {
      kind: 'comparison',
      left,
      op: token.value,
      right,
      position: { start: left.position.start, end: right.position.end },
      source: this.source,
    };
  }

  /** Lax-condition helper: the unknown operator Ruby would capture from the raw
   *  source — the contiguous `[=!<>a-z_]+` run starting at the first operator
   *  character after the left operand (skipping intervening whitespace). Returns
   *  `null` when the next non-space character is outside that class (no
   *  operator: the bare left operand stands — `true && false`, `true TRUE`).
   *  Mirrors `if.rb`'s lax `Syntax` operator group; the run is captured verbatim
   *  so `condition.rb` raises `Unknown operator <run>` for multi-token garbage
   *  (`=!`, `===`, `<foo`) the tokenizer would otherwise split or truncate. */
  private laxConditionOperatorRun(
    afterLeft: number,
  ): { value: string; start: number; end: number } | null {
    // Scan only within this statement's markup. In `{% liquid %}` line-mode
    // `this.source` is the whole template while `markupEnd` is the current
    // line's markup boundary, so an unbounded scan could skip the newline and
    // capture the next statement's tag name (`echo`, `assign`, …) as a bogus
    // operator. Honour `markupEnd` to keep the run inside the current line.
    let start = afterLeft;
    while (start < this.markupEnd && /\s/.test(this.source[start])) start += 1;
    const match = /^[=!<>a-z_]+/.exec(this.source.slice(start, this.markupEnd));
    if (!match) return null;
    return { value: match[0], start, end: start + match[0].length };
  }

  /** Lax-condition helper: build a comparison node carrying an unknown operator
   *  (`=`, `=!`, a bare word like `true`, …) so the engine can raise `Unknown
   *  operator <op>` at evaluate time (mirrors Ruby `condition.rb`, where the
   *  operator is captured during lax parse but only rejected when interpreted).
   *  Every token covered by the raw operator run is consumed — a multi-token
   *  garbage operator (`<foo` = a Comparison token + an Id token) advances past
   *  all of them — then the following value (if any) becomes the right operand,
   *  otherwise the left operand is reused as a placeholder. Only called under
   *  `lax && inCondition`. */
  private unknownOperatorComparison(
    left: ValueExpression,
    op: { value: string; start: number; end: number },
  ): Expression {
    while (this.peek().type !== MarkupTokenType.EndOfString && this.peek().start < op.end) {
      this.p += 1;
    }
    let right: ValueExpression = left;
    if (this.atValueStart()) {
      const savedP = this.p;
      try {
        right = this.valueExpression();
      } catch {
        // The operator is unknown, so the right operand is never meaningfully
        // evaluated: evaluation raises `Unknown operator <op>` before the operands
        // are compared, OR an enclosing `and`/`or` short-circuits this branch away
        // entirely. Ruby's lax `Syntax` captures the operand as a benign
        // `QuotedFragment` and only surfaces the error at evaluate time, so a
        // malformed operand (e.g. an unterminated `[`) must NOT abort the parse
        // here — doing so diverges from Ruby, which renders the short-circuited
        // branch (`{% if false and true ! [ %}…{% else %}NO{% endif %}` → `NO`).
        // Recover by skipping the unparseable tokens, stopping at a logical joiner
        // so a following `and`/`or` clause stays visible (preserving the
        // short-circuit structure), and reuse the left operand as an inert
        // placeholder (its value is never used under the unknown operator).
        this.p = savedP;
        while (
          this.peek().type !== MarkupTokenType.EndOfString &&
          this.peek().type !== MarkupTokenType.Logical
        ) {
          this.p += 1;
        }
        right = left;
      }
    }
    // Drop a stray trailing close paren after the recovered comparison.
    this.consumeOptional(MarkupTokenType.CloseRound);
    return {
      kind: 'comparison',
      left,
      // The operator is outside the known enum; it is preserved verbatim so the
      // engine raises `Unknown operator <op>`. Cast to satisfy the typed union.
      op: op.value as EqualityOperator | ComparisonOperator,
      right,
      position: { start: left.position.start, end: right.position.end },
      source: this.source,
    };
  }

  /** Lax-condition helper: build a comparison from a KNOWN operator that the
   *  tokenizer fused with the following characters into one Id token
   *  (`arr contains0` → a single `contains0` Id, no separate `contains`
   *  Comparison token). The operator was recovered from the raw source by
   *  `laxConditionOperatorRun`; its right operand was swallowed into the merged
   *  token, so it is recovered by re-tokenizing the source slice past the run
   *  (`0`) and parsing one value from it — mirroring Ruby `if.rb`'s lax
   *  `Syntax` `(QuotedFragment)\s*([=!<>a-z_]+)?\s*(QuotedFragment)?`, which
   *  captures `arr` / `contains` / `0` and evaluates `arr contains 0` normally.
   *  When nothing follows the run, Ruby's group-3 `QuotedFragment` is empty, so
   *  the right operand resolves to nil (NOT the left operand) — a null-named
   *  VariableLookup placeholder. Only called under
   *  `lax && inCondition` for a run where `isComparisonOp(op.value)` is true. */
  private mergedOperatorComparison(
    left: ValueExpression,
    op: { value: string; start: number; end: number },
  ): Expression {
    // Advance past every token the merged operator token covers (the run starts
    // inside a fused Id token, e.g. `contains0`, which extends past `op.end`).
    while (this.peek().type !== MarkupTokenType.EndOfString && this.peek().start < op.end) {
      this.p += 1;
    }
    // The right operand lives in the raw source immediately after the run; the
    // tokenizer merged it into the operator token, so re-tokenize the remaining
    // markup (offset-preserving) and parse one value from it. The sub-parser
    // uses the same 4-arg markup-bounded construction + `enableLax()` as the
    // other recovery sub-parsers (`lax-recover.ts`): Ruby's `if.rb` captures the
    // right operand as a greedy `QuotedFragment`, so a fused operand that is
    // itself malformed (`contains123foo` → `123foo`) must lax-recover to a
    // single lookup, matching Ruby, not split into `123` + residual.
    const rest = this.source.slice(op.end, this.markupEnd);
    const restParser = new MarkupParser(
      tokenizeMarkup(rest, op.end),
      this.source,
      op.end,
      this.markupEnd,
    ).enableLax();
    // Absent any value (`arr contains`, `1 ==`), Ruby's group-3 `QuotedFragment`
    // is empty and the right operand is nil — NOT the left operand. Reusing
    // `left` here would compare a value to itself (`"abc" contains "abc"` →
    // true, `1 == 1` → true), rendering the wrong branch. A null-named
    // VariableLookup resolves to nil, so `"abc" contains nil` → false and
    // `1 == nil` → false, matching Ruby 5.11.0 (verified: all render `no`).
    let right: ValueExpression = {
      type: NodeTypes.VariableLookup,
      name: null,
      lookups: [],
      position: { start: op.end, end: op.end },
      source: this.source,
    };
    if (restParser.atValueStart()) {
      right = restParser.valueExpression();
    }
    // Re-sync the main cursor past every main-stream token the recovered right
    // operand covers. The operand was parsed off the offset-preserving sub-parser,
    // so when it spans more than the fused Id token (`contains0.0` → operand `0.0`,
    // but the fused token is only `contains0`) the leftover Dot/Number tokens still
    // sit on the main stream. Left unconsumed, they block logicalExpr() from seeing
    // a following `and`/`or` — `str contains0.0 and false` would silently drop
    // `and false`, diverging from Ruby `if.rb`, which parses the fused and spaced
    // forms identically as `(str contains 0.0) and (false)`. When no value was
    // parsed (`arr contains`), `right` is the left placeholder whose end precedes
    // the operator run, so the loop is a no-op.
    while (
      this.peek().type !== MarkupTokenType.EndOfString &&
      this.peek().start < right.position.end
    ) {
      this.p += 1;
    }
    // Drop a stray trailing close paren after the recovered comparison, mirroring
    // comparison() and unknownOperatorComparison(). The right operand was parsed
    // off a re-tokenized slice, so the main stream's cursor still sits on the
    // grouping `)`; leaving it unconsumed hides any following logical clause
    // (`(str contains0) and false` would silently drop `and false`).
    this.consumeOptional(MarkupTokenType.CloseRound);
    return {
      kind: 'comparison',
      left,
      op: op.value as EqualityOperator | ComparisonOperator,
      right,
      position: { start: left.position.start, end: right.position.end },
      source: this.source,
    };
  }

  /** Lax helper: skip leading OpenRound tokens that do not introduce a range.
   *  Meaningless parens in conditions (`(false || true)`) are stripped by
   *  Ruby's lax condition parser. */
  private skipLaxConditionParens(): void {
    while (this.look(MarkupTokenType.OpenRound) && !this.parenAtCursorContainsRange()) {
      this.p += 1;
    }
  }

  /** Lax helper: like parenContainsRange but assumes the cursor is ON the
   *  OpenRound; scans its body for a depth-0 `..`. */
  private parenAtCursorContainsRange(): boolean {
    let depth = 0;
    for (let i = this.p; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === MarkupTokenType.EndOfString) break;
      if (t.type === MarkupTokenType.OpenRound) depth += 1;
      else if (t.type === MarkupTokenType.CloseRound) {
        depth -= 1;
        if (depth === 0) break;
      } else if (t.type === MarkupTokenType.DotDot && depth === 1) {
        return true;
      }
    }
    return false;
  }

  // logical := comparison (("and" | "or") logical)?
  logicalExpr(): Expression {
    const left = this.comparison();
    const token = this.peek();

    if (token.type !== MarkupTokenType.Logical) {
      return left;
    }

    if (!isLogicalOp(token.value)) {
      // Lax: an unknown logical operator ends the expression at the left
      // operand. (`||`/`&&` tokenize as Pipe/other, not Logical, so they are
      // handled by the early return above; this guards genuinely unknown
      // Logical-typed values.)
      if (this.lax) return left;
      throw new LiquidHTMLASTParsingError(
        `Unknown logical operator: ${token.value}`,
        this.source,
        token.start,
        token.end,
      );
    }

    const opStart = token.start;
    this.p += 1;
    const right = this.logicalExpr();

    return {
      kind: 'logical',
      left,
      op: token.value,
      right,
      opStart,
      position: { start: left.position.start, end: right.position.end },
      source: this.source,
    };
  }

  // conditionalExpression := logical
  conditionalExpression(): LiquidConditionalExpression {
    // Mark condition context so lax meaningless-paren stripping engages in
    // comparison() (conditions only — not value contexts).
    const savedInCondition = this.inCondition;
    this.inCondition = true;
    let result: LiquidConditionalExpression;
    try {
      result = adaptConditional(this.logicalExpr());
    } finally {
      this.inCondition = savedInCondition;
    }
    // Lax: silently eat any residual tokens after the recovered condition
    // (e.g. `|| true`, `&& false`, trailing garbage) — Ruby's lax condition
    // parser discards everything past the first parseable expression.
    if (this.lax) this.discardRemaining();
    // The original parser extends LogicalExpression position.end to the markup
    // boundary (eosStart), including any trailing whitespace. Comparison and
    // bare value nodes keep tight positions at the last token's end.
    // This applies to all nested LogicalExpression nodes, not just the root.
    if (result.type === NodeTypes.LogicalExpression) {
      extendLogicalEnd(result, this.eosStart());
    }
    return result;
  }

  // expression := logical
  expression(): ComplexLiquidExpression {
    return adaptComplex(this.logicalExpr());
  }

  // liquidVariable := expression filter*
  liquidVariable(): LiquidVariable {
    const expr = this.expression();
    const filterList = this.filters(expr.position.end);
    // Lax: swallow any residual tokens after the expression + filters (e.g. a
    // stray `)` in `'X' | downcase)`, or trailing garbage after `false a`).
    if (this.lax) {
      this.discardRemaining();
    }
    const tokenEnd =
      filterList.length > 0 ? filterList[filterList.length - 1].position.end : expr.position.end;
    const start = expr.position.start;
    // The end position must extend to the markup boundary (the EndOfString
    // token's start), which matches the closing delimiter position. Using the
    // last meaningful token's end would be 1 short because it excludes trailing
    // whitespace that the original parser considers part of the LiquidVariable.
    const eosToken = this.tokens[this.tokens.length - 1];
    const end = eosToken.start;
    return {
      type: NodeTypes.LiquidVariable,
      expression: expr,
      filters: filterList,
      rawSource: this.source.slice(start, tokenEnd),
      position: { start, end },
      source: this.source,
    };
  }

  // filters := ("|" filter)*
  filters(previousEnd: number = 0): LiquidFilter[] {
    const result: LiquidFilter[] = [];
    while (this.consumeOptional(MarkupTokenType.Pipe)) {
      // Lax: a `|` not followed by a filter name (e.g. trailing `|`) is dropped.
      if (this.lax && !this.look(MarkupTokenType.Id)) {
        this.skipToNextPipe();
        continue;
      }
      const filterNode = this.filter(previousEnd);
      result.push(filterNode);
      previousEnd = filterNode.position.end;
      // Lax: a filter may leave residual garbage before the next `|` separator
      // (e.g. the stray `"` in `split:"t"" | remove:"i" | first`). Ruby's lax
      // filter scan resyncs on the next `|`, dropping the malformed fragment
      // but preserving later well-formed filters. Skip to the next Pipe.
      if (this.lax && !this.isAtEnd() && !this.look(MarkupTokenType.Pipe)) {
        this.skipToNextPipe();
      }
    }
    return result;
  }

  // filter := id (":" arguments)?
  filter(previousEnd: number): LiquidFilter {
    const nameToken = this.consume(MarkupTokenType.Id);
    let args: LiquidArgument[] = [];
    let end = nameToken.end;
    if (this.consumeOptional(MarkupTokenType.Colon)) {
      // Lax: a colon with no following argument (`upcase:`) is tolerated; only
      // parse arguments when something argument-like actually follows.
      if (!this.lax || this.atArgumentStart()) {
        args = this.arguments();
      }
      if (args.length > 0) {
        end = args[args.length - 1].position.end;
      }
    }
    return {
      type: NodeTypes.LiquidFilter,
      name: nameToken.value,
      args,
      position: { start: previousEnd, end },
      source: this.source,
    };
  }

  // argument := namedArgument | valueExpression
  argument(): LiquidArgument {
    if (this.look(MarkupTokenType.Id) && this.lookaheadForNamedArgument()) {
      return this.namedArgument();
    }
    return this.valueExpression();
  }

  // Checks if the tokens starting at current position form a named argument key
  // Pattern: Id (Dot Id)* Colon
  private lookaheadForNamedArgument(): boolean {
    let ahead = 1;
    while (this.look(MarkupTokenType.Dot, ahead) && this.look(MarkupTokenType.Id, ahead + 1)) {
      ahead += 2;
    }
    return this.look(MarkupTokenType.Colon, ahead);
  }

  // namedArgument := id ("." id)* ":" valueExpression
  namedArgument(): LiquidNamedArgument {
    const nameToken = this.consume(MarkupTokenType.Id);
    let name = nameToken.value;
    while (this.consumeOptional(MarkupTokenType.Dot)) {
      const segment = this.consume(MarkupTokenType.Id);
      name += '.' + segment.value;
    }
    this.consume(MarkupTokenType.Colon);
    const value = this.valueExpression();
    return {
      type: NodeTypes.NamedArgument,
      name,
      value,
      position: { start: nameToken.start, end: value.position.end },
      source: this.source,
    };
  }

  // arguments := argument ("," argument)*
  arguments(): LiquidArgument[] {
    const args: LiquidArgument[] = [];
    args.push(this.argument());
    while (this.consumeOptional(MarkupTokenType.Comma)) {
      // Lax: a trailing or empty comma (`append: "x",`) ends the argument list
      // rather than forcing another argument parse.
      if (this.lax && !this.atArgumentStart()) {
        break;
      }
      args.push(this.argument());
    }
    return args;
  }

  // namedArguments := namedArgument ("," namedArgument)* ","?
  namedArguments(): LiquidNamedArgument[] {
    const args: LiquidNamedArgument[] = [];
    args.push(this.namedArgument());
    while (this.consumeOptional(MarkupTokenType.Comma)) {
      if (!this.look(MarkupTokenType.Id)) break; // trailing comma
      args.push(this.namedArgument());
    }
    return args;
  }

  /*
   * blockNamedArguments := blockNamedArgument ("," blockNamedArgument)* ","?
   *
   * Returns a single flat list of named arguments in source order. Block and
   * section tags use this path because both accept scalar values and
   * single-level array literals.
   */
  blockNamedArguments(): (LiquidNamedArgument | BlockArrayArgument)[] {
    const args: (LiquidNamedArgument | BlockArrayArgument)[] = [];
    this.pushBlockNamedArgument(args);
    while (this.consumeOptional(MarkupTokenType.Comma)) {
      if (!this.look(MarkupTokenType.Id)) break; /* trailing comma */
      this.pushBlockNamedArgument(args);
    }
    return args;
  }

  /*
   * Parses one block named argument and appends it to the unified list.
   * The if/else is required for TypeScript to narrow the value type into
   * the correct branch of the LiquidNamedArgument | BlockArrayArgument union.
   */
  private pushBlockNamedArgument(args: (LiquidNamedArgument | BlockArrayArgument)[]): void {
    const nameToken = this.consume(MarkupTokenType.Id);
    let name = nameToken.value;
    while (this.consumeOptional(MarkupTokenType.Dot)) {
      const segment = this.consume(MarkupTokenType.Id);
      name += '.' + segment.value;
    }
    this.consume(MarkupTokenType.Colon);
    const value = this.blockValueExpression();
    const position = { start: nameToken.start, end: value.position.end };

    if (value.type === 'BlockArrayLiteral') {
      args.push({
        type: NodeTypes.NamedArgument,
        name,
        value,
        position,
        source: this.source,
      });
    } else {
      args.push({
        type: NodeTypes.NamedArgument,
        name,
        value,
        position,
        source: this.source,
      });
    }
  }

  /*
   * Parses a block or section argument value: a leading `[` opens an array
   * literal, and everything else delegates to the shared `valueExpression()`.
   */
  private blockValueExpression(): LiquidExpression | BlockArrayLiteral {
    if (this.look(MarkupTokenType.OpenSquare)) {
      return this.blockArrayLiteral();
    }
    return this.valueExpression();
  }

  /*
   * Rejects a nested array element to match Ruby's "no nested arrays" rule.
   */
  private assertNotNestedArray(): void {
    if (this.look(MarkupTokenType.OpenSquare)) {
      const token = this.peek();
      throw new LiquidHTMLASTParsingError(
        'nested arrays are not supported in block array literal',
        this.source,
        token.start,
        token.end,
      );
    }
  }

  /*
   * Parses a single-level array literal; nested arrays are rejected and
   * elements are parsed by the shared `valueExpression()`.
   */
  private blockArrayLiteral(): BlockArrayLiteral {
    const openToken = this.consume(MarkupTokenType.OpenSquare);
    const elements: LiquidExpression[] = [];

    while (!this.look(MarkupTokenType.CloseSquare)) {
      this.assertNotNestedArray();
      elements.push(this.valueExpression());
      if (!this.look(MarkupTokenType.CloseSquare)) {
        this.consume(MarkupTokenType.Comma);
      }
    }

    const closeToken = this.consume(MarkupTokenType.CloseSquare);

    return {
      type: 'BlockArrayLiteral',
      elements,
      position: { start: openToken.start, end: closeToken.end },
      source: this.source,
    };
  }

  private computeLastTokenEnd(): number {
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      if (this.tokens[i].type !== MarkupTokenType.EndOfString) {
        return this.tokens[i].end;
      }
    }
    return this.tokens[0]?.start ?? 0;
  }
}

/** Recursively extend position.end to `end` on all nested LogicalExpression nodes. */
function extendLogicalEnd(node: LiquidConditionalExpression, end: number): void {
  if (node.type !== NodeTypes.LogicalExpression) return;
  node.position = { ...node.position, end };
  extendLogicalEnd(node.right as LiquidConditionalExpression, end);
}

function isComparisonOp(s: string): s is EqualityOperator | ComparisonOperator {
  return EQUALITY_OPERATORS.has(s) || COMPARISON_OPERATORS.has(s);
}

function isLogicalOp(s: string): s is LogicalOperator {
  return LOGICAL_OPERATORS.has(s);
}

function isLiteralKeyword(s: string): s is keyof typeof LiquidLiteralValues {
  return s in LiquidLiteralValues;
}
