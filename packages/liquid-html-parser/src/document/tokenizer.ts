import { assertNever } from '../utils';
import { findRawBodyEnd, liquidTagTokenName } from './raw-body';
import type { RawBodyRuleFor } from './raw-body';

export enum TokenType {
  Text = 'Text',
  LiquidTagOpen = 'LiquidTagOpen',
  LiquidTagClose = 'LiquidTagClose',
  LiquidVariableOutputOpen = 'LiquidVariableOutputOpen',
  LiquidVariableOutputClose = 'LiquidVariableOutputClose',
  HtmlTagOpen = 'HtmlTagOpen',
  HtmlCloseTagOpen = 'HtmlCloseTagOpen',
  HtmlTagClose = 'HtmlTagClose',
  HtmlSelfClose = 'HtmlSelfClose',
  HtmlCommentOpen = 'HtmlCommentOpen',
  HtmlCommentClose = 'HtmlCommentClose',
  HtmlDoctypeOpen = 'HtmlDoctypeOpen',
  HtmlEquals = 'HtmlEquals',
  HtmlQuoteOpen = 'HtmlQuoteOpen',
  HtmlQuoteClose = 'HtmlQuoteClose',
  YamlFrontmatter = 'YamlFrontmatter',
  EndOfInput = 'EndOfInput',
}

export interface Token {
  type: TokenType;
  start: number;
  end: number;
}

export interface TokenizeOptions {
  /**
   * Skip the document-start YAML frontmatter check. YAML frontmatter is only
   * valid at offset 0 of a document; when re-tokenizing a mid-document suffix
   * (see `ParserBase.resliceTokensFrom`) the leading `---` must NOT be treated
   * as frontmatter.
   */
  skipFrontmatter?: boolean;

  /**
   * Begin tokenizing inside an HTML quoted attribute value, closing on the
   * given quote character (`"` or `'`). When a `{% raw %}` straddles the
   * end-tag boundary *inside* a quoted attribute, the suffix re-tokenize (see
   * `ParserBase.resliceTokensFrom`) must resume in `QuotedValue` mode so the
   * attribute's closing quote and `>` are emitted as `HtmlQuoteClose`/
   * `HtmlTagClose` rather than `Text`; a fresh document-start tokenize would
   * lose that context and make attribute parsing throw.
   */
  insideQuotedAttribute?: string;

  /**
   * Begin tokenizing inside an open HTML tag (the attribute list of `<div …`),
   * but NOT inside a quoted attribute value. When a `{% raw %}` straddles the
   * end-tag boundary while the parser is between *unquoted* attributes, the
   * suffix re-tokenize must resume in `HtmlTag` mode so the tag's closing `>`
   * emits as `HtmlTagClose` (only `HtmlTag` mode turns `>` into a tag close;
   * `Default` mode emits it as `Text`). Without this the attribute list never
   * breaks on the real `>`, consumes a later element's close, and
   * `parseHtmlElement` throws at EOF with the element still open. Ignored when
   * `insideQuotedAttribute` is set (that path already nests `HtmlTag` beneath
   * `QuotedValue`).
   */
  insideHtmlTag?: boolean;

  /**
   * Tokenize the whole input as the body of a `<script>` or `<style>` element:
   * only Liquid delimiters are recognized, and everything else is Text, so
   * JavaScript like `i<n` cannot open an HTML tag. The caller passes exactly the
   * body, so no mode can run past its close tag. See
   * `ParserBase.retokenizeRawText`.
   */
  rawText?: boolean;

  /**
   * The body rule of each Liquid raw tag (`comment`, `raw`, `doc`, `schema`,
   * …), from the tag registry. When set, a raw tag's body is opaque: it ends
   * where `findRawBodyEnd` ends it, the same rule the parser uses, only
   * Liquid delimiters are tokens inside it, and the mode before the tag holds
   * again after it. So a `<!--`, a `<b` or a quote in `{% comment %}` can't
   * open a mode that outlives the body. Without it, raw bodies are tokenized
   * like any other markup.
   */
  rawBodyRule?: RawBodyRuleFor;
}

export function tokenize(source: string, options: TokenizeOptions = {}): Token[] {
  return tokenizeToEnd(source, options, true);
}

/**
 * `tokenize` without the text fast path: plain text advances one character at
 * a time. Test-only reference for checking that the fast path never skips over
 * a token start. Not exported from the package.
 */
export function tokenizeWithoutFastPath(source: string, options: TokenizeOptions = {}): Token[] {
  return tokenizeToEnd(source, options, false);
}

function tokenizeToEnd(source: string, options: TokenizeOptions, fastPath: boolean): Token[] {
  const tokens: Token[] = [];
  const tokenizer = createTokenizer(source, tokens, fastPath);
  tokenizer.restart(0, options);
  tokenizer.fill(Infinity);
  return tokens;
}

/**
 * `tokenize`, run on demand. `ParserBase.resliceTokensFrom` uses it to
 * re-tokenize the rest of a document only as far as the parser reads.
 */
export interface Tokenizer {
  /**
   * Start over at `start`, as if `source` began there; tokens keep their
   * offsets in `source`.
   */
  restart(start: number, options?: TokenizeOptions): void;

  /**
   * Add tokens until there are more than `index` of them, or until the input
   * runs out, which adds `EndOfInput`. Returns whether input remains.
   */
  fill(index: number): boolean;
}

export function createTokenizer(source: string, tokens: Token[], fastPath = true): Tokenizer {
  const modeStack: Mode[] = [];
  let mode = Mode.Default as Mode;
  let pos = 0;
  let textStart = -1;
  // Whether the pending Text run is whitespace. Only HtmlTag mode reads it.
  let textIsSpace = false;
  let quoteChar = '';
  let ended = false;
  let rawBodyRule: RawBodyRuleFor | undefined;
  // Where the current comment's body starts, for the spec's empty comments
  // `<!-->` and `<!--->`, which close only right after `<!--`.
  let commentBodyStart = -1;
  // Where the `{%` of the Liquid tag being tokenized starts.
  let liquidTagStart = -1;
  // How many `<svg>` elements are open. The parser keeps an `<svg>` body raw
  // and closes it at the `</svg>` token that balances it, so inside one the
  // tokenizer opens no comment mode that could hide that token: SVG holds
  // CDATA, `foreignObject` scripts and other text where a `<!--` is not a
  // comment. There `<!--` and `-->` tokenize as they did before comment mode.
  // Nested `<svg` open tags count as `scanForHtmlCloseTag` counts them,
  // self-closing ones included.
  let svgDepth = 0;
  // The element whose open tag is being tokenized, when it is `svg`, `script`
  // or `style`: the tag's `>` opens it.
  let pendingElement: 'svg' | 'script' | 'style' | undefined;
  // The `<script>` or `<style>` whose body is being tokenized in RawText mode,
  // or "" when the input is a body passed with `rawText` (no close tag).
  let rawTextTag = '';
  // The last search for `}}`: where it started, and where it found one (-1 for
  // nowhere). Restarts after raw tags can land inside the same unclosed `{{`
  // again and again, and this keeps each from searching the rest anew.
  let closeSearchFrom = Infinity;
  let closeFound = -1;

  function ch(offset: number): string {
    const i = pos + offset;
    return i < source.length ? source[i] : '';
  }

  function match(s: string): boolean {
    return source.startsWith(s, pos);
  }

  function flushText() {
    if (textStart !== -1) {
      tokens.push({ type: TokenType.Text, start: textStart, end: pos });
      textStart = -1;
    }
  }

  function emit(type: TokenType, length: number) {
    flushText();
    tokens.push({ type, start: pos, end: pos + length });
    pos += length;
  }

  function pushMode(next: Mode) {
    modeStack.push(mode);
    mode = next;
  }

  function popMode() {
    mode = modeStack.length > 0 ? modeStack.pop()! : Mode.Default;
  }

  function startText() {
    if (textStart === -1) textStart = pos;
  }

  /** Moves past plain text, to where the current mode's next token could start. */
  function skipText() {
    if (!fastPath) {
      pos++;
    } else if (mode === Mode.LiquidVariableOutput) {
      pos = nextOutputClose();
    } else {
      pos = nextTextCandidate(source, pos + 1, mode, quoteChar, textIsSpace);
    }
  }

  /**
   * Where the `-}}` or `}}` that closes Liquid output at `pos` begins, or the
   * end of the input. Neither begins at `pos` itself.
   */
  function nextOutputClose(): number {
    if (pos < closeSearchFrom || (closeFound !== -1 && pos > closeFound)) {
      closeSearchFrom = pos;
      closeFound = source.indexOf('}}', pos);
    }
    if (closeFound === -1) return source.length;
    return source[closeFound - 1] === '-' ? closeFound - 1 : closeFound;
  }

  function restart(start: number, options: TokenizeOptions = {}) {
    modeStack.length = 0;
    mode = Mode.Default;
    pos = start;
    textStart = -1;
    ended = false;
    rawBodyRule = options.rawBodyRule;
    commentBodyStart = -1;
    liquidTagStart = -1;
    svgDepth = 0;
    pendingElement = undefined;
    rawTextTag = '';

    // Resume inside a quoted attribute value when reslicing a suffix that begins
    // mid-attribute (e.g. `...{% endraw %}">` straddled by a stray `{{`). The
    // enclosing HtmlTag mode is kept beneath QuotedValue so popping on the
    // closing quote correctly emits the attribute close and trailing `>`.
    if (options.insideQuotedAttribute) {
      quoteChar = options.insideQuotedAttribute;
      modeStack.push(Mode.HtmlTag);
      mode = Mode.QuotedValue;
    } else if (options.insideHtmlTag) {
      // Resume inside the attribute list of an open tag. The empty mode stack
      // means the closing `>` pops back to `Default`, so the rest of the suffix
      // (`>ok</div>`) tokenizes as normal document content.
      mode = Mode.HtmlTag;
    } else if (options.rawText) {
      mode = Mode.RawText;
    }

    // YAML frontmatter: only at position 0
    if (!options.skipFrontmatter && (match('---\n') || match('---\r\n'))) {
      const searchStart = source.indexOf('\n', pos) + 1;
      const closeIdx = source.indexOf('\n---', searchStart);
      if (closeIdx !== -1) {
        let end = closeIdx + 4; // after \n---
        // Include trailing newline/CRLF
        if (end < source.length && source[end] === '\r') end++;
        if (end < source.length && source[end] === '\n') end++;
        tokens.push({ type: TokenType.YamlFrontmatter, start: pos, end });
        pos = end;
      }
    }
  }

  // Liquid open check — reused in every mode outside Liquid
  function scanLiquidOpen(): boolean {
    if (source.charCodeAt(pos) !== CHAR_OPEN_BRACE) return false;
    if (match('{{-')) {
      emit(TokenType.LiquidVariableOutputOpen, 3);
      pushMode(Mode.LiquidVariableOutput);
      return true;
    }
    if (match('{{')) {
      emit(TokenType.LiquidVariableOutputOpen, 2);
      pushMode(Mode.LiquidVariableOutput);
      return true;
    }
    if (match('{%-')) {
      liquidTagStart = pos;
      emit(TokenType.LiquidTagOpen, 3);
      pushMode(Mode.LiquidTag);
      return true;
    }
    if (match('{%')) {
      liquidTagStart = pos;
      emit(TokenType.LiquidTagOpen, 2);
      pushMode(Mode.LiquidTag);
      return true;
    }
    return false;
  }

  // After the close of a Liquid tag, when the tag is a raw tag whose body
  // closes: tokenize the body on its own, so nothing in it can change the mode
  // the tag sits in, and resume at its end tag in that mode. A body Liquid
  // reports as never closed is left to the parser, which throws on it.
  function skipRawBody() {
    if (!rawBodyRule) return;
    const name = liquidTagTokenName(source.slice(liquidTagStart, pos));
    const rule = name === undefined ? undefined : rawBodyRule(name);
    if (name === undefined || rule === undefined) return;
    const end = findRawBodyEnd(source, pos, name, rule, rawBodyRule);
    if (!end || end.tagStart <= pos) return;

    const bodyStart = pos;
    const body = tokenizeToEnd(
      source.slice(bodyStart, end.tagStart),
      { skipFrontmatter: true, rawText: true, rawBodyRule },
      fastPath,
    );
    for (const token of body) {
      if (token.type === TokenType.EndOfInput) continue;
      tokens.push({ type: token.type, start: token.start + bodyStart, end: token.end + bodyStart });
    }
    pos = end.tagStart;
  }

  // The lowercase name at `at` when it is `svg`, `script` or `style` followed by
  // whitespace, `/` or `>` (or the end), as the parser names those elements.
  function elementNameAt(at: number): 'svg' | 'script' | 'style' | undefined {
    const match = /^(svg|script|style)(?=[\s/>]|$)/i.exec(source.slice(at, at + 7));
    if (match) return match[1]!.toLowerCase() as 'svg' | 'script' | 'style';
    // An `<svg` glued to Liquid, as in `<svg{% if x %} class="x"{% endif %}>`, may
    // be the `svg` element with a Liquid attribute or a compound name such as
    // `<svg{{ x }}-icon>`; only the parser can tell. Treat it as an `<svg>`: in
    // one, comments tokenize as they did before comment mode, so a wrong guess
    // costs nothing.
    return /^svg\{/i.test(source.slice(at, at + 4)) ? 'svg' : undefined;
  }

  // Whether `</` at `at` begins a `</svg>` the parser closes an `<svg>` raw body
  // on: the whole `</svg>`, whitespace allowed before `>`. `</svg marker>`
  // doesn't close it, so it doesn't end the SVG body here either.
  function closesSvg(at: number): boolean {
    return /^<\/svg\s*>/i.test(source.slice(at, at + 64));
  }

  // Whether `</` at `at` begins the close tag of the current raw text element:
  // the whole `</script>`, whitespace allowed before `>`.
  function closesRawText(at: number): boolean {
    if (rawTextTag === '') return false;
    const name = source.slice(at + 2, at + 2 + rawTextTag.length);
    if (name.toLowerCase() !== rawTextTag) return false;
    let i = at + 2 + rawTextTag.length;
    while (i < source.length && /\s/.test(source[i]!)) i++;
    return source[i] === '>';
  }

  // At the `>` of an open tag: enter the element it named, if it matters. An
  // `<svg>` starts an SVG body. A `<script>` or `<style>` outside SVG
  // has a raw text body; inside SVG it is foreign content, read as markup.
  function openPendingElement() {
    const element = pendingElement;
    pendingElement = undefined;
    if (element === 'svg') {
      if (svgDepth === 0) svgDepth = 1;
    } else if (element !== undefined && svgDepth === 0 && mode === Mode.Default) {
      rawTextTag = element;
      pushMode(Mode.RawText);
    }
  }

  function fill(index: number): boolean {
    while (pos < source.length && tokens.length <= index) {
      switch (mode) {
        case Mode.LiquidTag: {
          if (match('-%}')) {
            emit(TokenType.LiquidTagClose, 3);
            popMode();
            skipRawBody();
          } else if (match('%}')) {
            emit(TokenType.LiquidTagClose, 2);
            popMode();
            skipRawBody();
          } else {
            startText();
            skipText();
          }
          break;
        }

        case Mode.LiquidVariableOutput: {
          if (match('-}}')) {
            emit(TokenType.LiquidVariableOutputClose, 3);
            popMode();
          } else if (match('}}')) {
            emit(TokenType.LiquidVariableOutputClose, 2);
            popMode();
          } else {
            startText();
            skipText();
          }
          break;
        }

        case Mode.Default: {
          if (scanLiquidOpen()) continue;

          // Inside an `<svg>`, `<!--` and `-->` are the one-off tokens they were
          // before comment mode, and open no mode.
          if (match('<!--') && svgDepth > 0) {
            emit(TokenType.HtmlCommentOpen, 4);
            continue;
          }

          if (match('-->') && svgDepth > 0) {
            emit(TokenType.HtmlCommentClose, 3);
            continue;
          }

          if (match('<!--')) {
            emit(TokenType.HtmlCommentOpen, 4);
            pushMode(Mode.HtmlComment);
            commentBodyStart = pos;
            continue;
          }

          if (match('<!')) {
            emit(TokenType.HtmlDoctypeOpen, 2);
            pushMode(Mode.HtmlTag);
            continue;
          }

          if (match('</')) {
            if (isTagNameStart(source.charCodeAt(pos + 2))) {
              if (svgDepth > 0 && closesSvg(pos)) svgDepth--;
              emit(TokenType.HtmlCloseTagOpen, 2);
              pushMode(Mode.HtmlTag);
              continue;
            }
          }

          if (ch(0) === '<') {
            if (isTagNameStart(source.charCodeAt(pos + 1))) {
              pendingElement = elementNameAt(pos + 1);
              if (svgDepth > 0 && pendingElement === 'svg') svgDepth++;
              emit(TokenType.HtmlTagOpen, 1);
              pushMode(Mode.HtmlTag);
              continue;
            }
          }

          startText();
          skipText();
          break;
        }

        case Mode.HtmlTag: {
          if (scanLiquidOpen()) continue;

          if (match('/>')) {
            emit(TokenType.HtmlSelfClose, 2);
            popMode();
            pendingElement = undefined;
            continue;
          }

          if (ch(0) === '>') {
            emit(TokenType.HtmlTagClose, 1);
            popMode();
            openPendingElement();
            continue;
          }

          if (ch(0) === '=') {
            emit(TokenType.HtmlEquals, 1);
            continue;
          }

          // Accept straight quotes and curly (smart) quotes as attribute-value
          // openers. Curly quotes get normalized to straight quotes downstream;
          // recognizing them here (HTML scope only — Liquid tokenization is
          // untouched) stops the value from splitting at interior spaces.
          if (
            ch(0) === '"' ||
            ch(0) === "'" ||
            ch(0) === '“' ||
            ch(0) === '”' ||
            ch(0) === '‘' ||
            ch(0) === '’'
          ) {
            quoteChar = ch(0);
            emit(TokenType.HtmlQuoteOpen, 1);
            pushMode(Mode.QuotedValue);
            continue;
          }

          // A run of whitespace inside a tag is a Text token of its own, never
          // part of a name or an unquoted value. It plays the part of ohm's
          // `space`, which the grammar's syntactic attribute rules skipped
          // implicitly (`attr = "v"` is one attribute).
          const isSpace = /\s/.test(ch(0));
          if (textStart !== -1 && isSpace !== textIsSpace) flushText();
          if (textStart === -1) textIsSpace = isSpace;
          startText();
          skipText();
          break;
        }

        case Mode.QuotedValue: {
          if (scanLiquidOpen()) continue;

          // Curly quotes are directional, so a value opened with a left curly
          // quote closes on its right partner (and vice-versa); straight quotes
          // close on themselves.
          if (ch(0) === closingQuoteFor(quoteChar) || ch(0) === quoteChar) {
            emit(TokenType.HtmlQuoteClose, 1);
            popMode();
            continue;
          }

          startText();
          skipText();
          break;
        }

        case Mode.HtmlComment: {
          // A comment's body is text, except for Liquid, which still renders
          // inside it, and the comment's close. Markup in the body (`<b`, an
          // unbalanced quote, a nested `<!--`) is text, as it is to a browser, so
          // it can't open a tag that swallows the close.
          if (scanLiquidOpen()) continue;

          // The HTML spec closes `<!-->` and `<!--->` as empty comments
          // ("abrupt-closing-of-empty-comment"). This applies only right after
          // `<!--`; anywhere later, `>` and `->` are text.
          if (pos === commentBodyStart) {
            if (ch(0) === '>') {
              emit(TokenType.HtmlCommentClose, 1);
              popMode();
              continue;
            }
            if (match('->')) {
              emit(TokenType.HtmlCommentClose, 2);
              popMode();
              continue;
            }
          }

          if (match('-->')) {
            emit(TokenType.HtmlCommentClose, 3);
            popMode();
            continue;
          }

          // `--!>` closes a comment too ("incorrectly-closed-comment").
          if (match('--!>')) {
            emit(TokenType.HtmlCommentClose, 4);
            popMode();
            continue;
          }

          startText();
          skipText();
          break;
        }

        case Mode.RawText: {
          // A `<script>` or `<style>` body is text, except for Liquid, which
          // still renders inside it, and the element's close tag. A `<!--`, a
          // `<svg`, or a quote in the body is text, as it is to a browser.
          if (scanLiquidOpen()) continue;

          if (match('</') && closesRawText(pos)) {
            popMode();
            rawTextTag = '';
            emit(TokenType.HtmlCloseTagOpen, 2);
            pushMode(Mode.HtmlTag);
            continue;
          }

          startText();
          skipText();
          break;
        }

        default:
          assertNever(mode);
      }
    }
    if (pos < source.length) return true;
    if (!ended) {
      flushText();
      tokens.push({ type: TokenType.EndOfInput, start: source.length, end: source.length });
      ended = true;
    }
    return false;
  }

  return { restart, fill };
}

/*
 * Text fast path: most characters cannot start (or close) a token in the
 * current mode. Each helper returns the first index >= `from` where the
 * mode's `match()` checks could succeed, so the run of plain text before it is
 * consumed in one step. Inside an HTML tag a run also ends where text switches
 * between whitespace and non-whitespace, because each is its own Text token.
 * Returning a superset of real token starts is safe: the main loop re-checks
 * that position and treats a non-match as text. Missing a token start is not,
 * so a new token type needs its first character added to its mode's helper
 * (tokenizer.test.ts compares against `tokenizeWithoutFastPath` to catch this).
 * Liquid output jumps with `nextOutputClose` instead, which caches its search.
 */

function nextTextCandidate(
  source: string,
  from: number,
  mode: Exclude<Mode, Mode.LiquidVariableOutput>,
  quoteChar: string,
  textIsSpace: boolean,
): number {
  switch (mode) {
    case Mode.Default:
      return nextDefaultCandidate(source, from);
    case Mode.HtmlTag:
      return nextHtmlTagCandidate(source, from, textIsSpace);
    case Mode.QuotedValue:
      return nextQuotedValueCandidate(source, from, quoteChar);
    case Mode.LiquidTag:
      return nextLiquidTagCloseCandidate(source, from);
    case Mode.RawText:
      return nextRawTextCandidate(source, from);
    case Mode.HtmlComment:
      return nextHtmlCommentCandidate(source, from);
    default:
      return assertNever(mode);
  }
}

const CHAR_DOUBLE_QUOTE = 0x22; // "
const CHAR_SINGLE_QUOTE = 0x27; // '
const CHAR_DASH = 0x2d; // -
const CHAR_SLASH = 0x2f; // /
const CHAR_LESS_THAN = 0x3c; // <
const CHAR_EQUALS = 0x3d; // =
const CHAR_GREATER_THAN = 0x3e; // >
const CHAR_OPEN_BRACE = 0x7b; // {
const CHAR_LEFT_SINGLE_CURLY_QUOTE = 0x2018; // ‘
const CHAR_RIGHT_DOUBLE_CURLY_QUOTE = 0x201d; // ”

/** Default mode tokens start with `{` (Liquid), `<` (HTML), or `-` (`-->` in an `<svg>`). */
function nextDefaultCandidate(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === CHAR_LESS_THAN || c === CHAR_DASH) return i;
  }
  return source.length;
}

/**
 * HtmlComment mode tokens start with `{` (Liquid) or `-` (`-->`, `--!>`). The
 * empty-comment closes `>` and `->` are checked only at the body's first
 * character, before any text run starts.
 */
function nextHtmlCommentCandidate(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === CHAR_DASH) return i;
  }
  return source.length;
}

/** RawText mode tokens start with `{` (Liquid) or `<` (the element's close tag). */
function nextRawTextCandidate(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === CHAR_LESS_THAN) return i;
  }
  return source.length;
}

/**
 * HtmlTag mode tokens start with `{`, `/`, `>`, `=`, or a straight/curly quote;
 * a Text run also ends where whitespace starts or stops.
 */
function nextHtmlTagCandidate(source: string, from: number, textIsSpace: boolean): number {
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (
      c === CHAR_OPEN_BRACE ||
      c === CHAR_SLASH ||
      c === CHAR_GREATER_THAN ||
      c === CHAR_EQUALS ||
      c === CHAR_DOUBLE_QUOTE ||
      c === CHAR_SINGLE_QUOTE ||
      (c >= CHAR_LEFT_SINGLE_CURLY_QUOTE && c <= CHAR_RIGHT_DOUBLE_CURLY_QUOTE) ||
      isWhitespace(c) !== textIsSpace
    ) {
      return i;
    }
  }
  return source.length;
}

/** QuotedValue mode tokens start with `{` or either quote of the open pair. */
function nextQuotedValueCandidate(source: string, from: number, quote: string): number {
  const open = quote.charCodeAt(0);
  const close = closingQuoteFor(quote).charCodeAt(0);
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === open || c === close) return i;
  }
  return source.length;
}

/**
 * Liquid tag bodies only end at `%}`, optionally preceded by `-`. Any `-%}`
 * match contains a `%}` one character later, so the earliest close is at the
 * first `%}` or the `-` immediately before it.
 */
function nextLiquidTagCloseCandidate(source: string, from: number): number {
  const i = source.indexOf('%}', from);
  if (i === -1) return source.length;
  return i > from && source.charCodeAt(i - 1) === CHAR_DASH ? i - 1 : i;
}

/** `[a-zA-Z{]`: what may follow `<` or `</` to open an HTML tag. */
function isTagNameStart(c: number): boolean {
  return (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || c === CHAR_OPEN_BRACE;
}

/** Exactly the UTF-16 code units JavaScript's `\s` matches. */
function isWhitespace(c: number): boolean {
  return (
    (c >= 0x09 && c <= 0x0d) ||
    c === 0x20 ||
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}

enum Mode {
  Default = 'Default',
  HtmlTag = 'HtmlTag',
  QuotedValue = 'QuotedValue',
  LiquidTag = 'LiquidTag',
  LiquidVariableOutput = 'LiquidVariableOutput',
  RawText = 'RawText',
  HtmlComment = 'HtmlComment',
}

// Curly (smart) quotes come in directional pairs: a value opened with a left
// curly quote closes on its right partner and vice-versa. Straight quotes are
// their own partner, so they close on an identical character.
function closingQuoteFor(open: string): string {
  switch (open) {
    case '“':
      return '”';
    case '”':
      return '“';
    case '‘':
      return '’';
    case '’':
      return '‘';
    default:
      return open;
  }
}
