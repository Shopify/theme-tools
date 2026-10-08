import { assertNever } from '../utils';

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
}

export function tokenize(source: string, options: TokenizeOptions = {}): Token[] {
  return tokenizeWith(source, options, nextTextCandidate);
}

/**
 * `tokenize` without the text fast path: plain text advances one character at
 * a time. Test-only reference for checking that the fast path never skips over
 * a token start. Not exported from the package.
 */
export function tokenizeWithoutFastPath(source: string, options: TokenizeOptions = {}): Token[] {
  return tokenizeWith(source, options, (_source, from) => from);
}

type NextTextCandidate = (source: string, from: number, mode: Mode, quoteChar: string) => number;

function tokenizeWith(
  source: string,
  options: TokenizeOptions,
  nextCandidate: NextTextCandidate,
): Token[] {
  const tokens: Token[] = [];
  const modeStack: Mode[] = [];
  let mode = Mode.Default as Mode;
  let pos = 0;
  let textStart = -1;
  let quoteChar = '';

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
  }

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

  // YAML frontmatter: only at position 0
  if (!options.skipFrontmatter && (match('---\n') || match('---\r\n'))) {
    const searchStart = source.indexOf('\n', 0) + 1;
    const closeIdx = source.indexOf('\n---', searchStart);
    if (closeIdx !== -1) {
      let end = closeIdx + 4; // after \n---
      // Include trailing newline/CRLF
      if (end < source.length && source[end] === '\r') end++;
      if (end < source.length && source[end] === '\n') end++;
      tokens.push({ type: TokenType.YamlFrontmatter, start: 0, end });
      pos = end;
    }
  }

  // Liquid open check — reused in Default, HtmlTag, and QuotedValue modes
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
      emit(TokenType.LiquidTagOpen, 3);
      pushMode(Mode.LiquidTag);
      return true;
    }
    if (match('{%')) {
      emit(TokenType.LiquidTagOpen, 2);
      pushMode(Mode.LiquidTag);
      return true;
    }
    return false;
  }

  while (pos < source.length) {
    switch (mode) {
      case Mode.LiquidTag: {
        if (match('-%}')) {
          emit(TokenType.LiquidTagClose, 3);
          popMode();
        } else if (match('%}')) {
          emit(TokenType.LiquidTagClose, 2);
          popMode();
        } else {
          startText();
          pos = nextCandidate(source, pos + 1, mode, quoteChar);
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
          pos = nextCandidate(source, pos + 1, mode, quoteChar);
        }
        break;
      }

      case Mode.Default: {
        if (scanLiquidOpen()) continue;

        if (match('<!--')) {
          emit(TokenType.HtmlCommentOpen, 4);
          continue;
        }

        if (match('-->')) {
          emit(TokenType.HtmlCommentClose, 3);
          continue;
        }

        if (match('<!')) {
          emit(TokenType.HtmlDoctypeOpen, 2);
          pushMode(Mode.HtmlTag);
          continue;
        }

        if (match('</')) {
          if (isTagNameStart(source.charCodeAt(pos + 2))) {
            emit(TokenType.HtmlCloseTagOpen, 2);
            pushMode(Mode.HtmlTag);
            continue;
          }
        }

        if (ch(0) === '<') {
          if (isTagNameStart(source.charCodeAt(pos + 1))) {
            emit(TokenType.HtmlTagOpen, 1);
            pushMode(Mode.HtmlTag);
            continue;
          }
        }

        startText();
        pos = nextCandidate(source, pos + 1, mode, quoteChar);
        break;
      }

      case Mode.HtmlTag: {
        if (scanLiquidOpen()) continue;

        if (match('/>')) {
          emit(TokenType.HtmlSelfClose, 2);
          popMode();
          continue;
        }

        if (ch(0) === '>') {
          emit(TokenType.HtmlTagClose, 1);
          popMode();
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

        startText();
        pos = nextCandidate(source, pos + 1, mode, quoteChar);
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
        pos = nextCandidate(source, pos + 1, mode, quoteChar);
        break;
      }

      default:
        assertNever(mode);
    }
  }

  flushText();
  tokens.push({ type: TokenType.EndOfInput, start: source.length, end: source.length });
  return tokens;
}

/*
 * Text fast path: most characters cannot start (or close) a token in the
 * current mode. Each helper returns the first index >= `from` where the
 * mode's `match()` checks could succeed, so the run of plain text before it is
 * consumed in one step. Returning a superset of real token starts is safe: the
 * main loop re-checks that position and treats a non-match as text. Missing a
 * token start is not, so a new token type needs its first character added to
 * its mode's helper (tokenizer.test.ts compares against
 * `tokenizeWithoutFastPath` to catch this).
 */

function nextTextCandidate(source: string, from: number, mode: Mode, quoteChar: string): number {
  switch (mode) {
    case Mode.Default:
      return nextDefaultCandidate(source, from);
    case Mode.HtmlTag:
      return nextHtmlTagCandidate(source, from);
    case Mode.QuotedValue:
      return nextQuotedValueCandidate(source, from, quoteChar);
    case Mode.LiquidTag:
      return nextLiquidCloseCandidate(source, from, '%}');
    case Mode.LiquidVariableOutput:
      return nextLiquidCloseCandidate(source, from, '}}');
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

/** Default mode tokens start with `{` (Liquid), `<` (HTML), or `-` (`-->`). */
function nextDefaultCandidate(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === CHAR_LESS_THAN || c === CHAR_DASH) return i;
  }
  return source.length;
}

/** HtmlTag mode tokens start with `{`, `/`, `>`, `=`, or a straight/curly quote. */
function nextHtmlTagCandidate(source: string, from: number): number {
  for (let i = from; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (
      c === CHAR_OPEN_BRACE ||
      c === CHAR_SLASH ||
      c === CHAR_GREATER_THAN ||
      c === CHAR_EQUALS ||
      c === CHAR_DOUBLE_QUOTE ||
      c === CHAR_SINGLE_QUOTE ||
      (c >= CHAR_LEFT_SINGLE_CURLY_QUOTE && c <= CHAR_RIGHT_DOUBLE_CURLY_QUOTE)
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
 * Liquid tag/output bodies only end at `%}`/`}}`, optionally preceded by `-`.
 * Any `-%}` match contains a `%}` one character later, so the earliest close
 * is at the first `%}` or the `-` immediately before it.
 */
function nextLiquidCloseCandidate(source: string, from: number, close: '%}' | '}}'): number {
  const i = source.indexOf(close, from);
  if (i === -1) return source.length;
  return i > from && source.charCodeAt(i - 1) === CHAR_DASH ? i - 1 : i;
}

/** `[a-zA-Z{]`: what may follow `<` or `</` to open an HTML tag. */
function isTagNameStart(c: number): boolean {
  return (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || c === CHAR_OPEN_BRACE;
}

enum Mode {
  Default = 'Default',
  HtmlTag = 'HtmlTag',
  QuotedValue = 'QuotedValue',
  LiquidTag = 'LiquidTag',
  LiquidVariableOutput = 'LiquidVariableOutput',
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
