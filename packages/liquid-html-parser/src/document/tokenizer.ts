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
          pos++;
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
          pos++;
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
          const after = ch(2);
          if (/[a-zA-Z]/.test(after) || after === '{') {
            emit(TokenType.HtmlCloseTagOpen, 2);
            pushMode(Mode.HtmlTag);
            continue;
          }
        }

        if (ch(0) === '<') {
          const after = ch(1);
          if (/[a-zA-Z]/.test(after) || after === '{') {
            emit(TokenType.HtmlTagOpen, 1);
            pushMode(Mode.HtmlTag);
            continue;
          }
        }

        startText();
        pos++;
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

        if (ch(0) === '"' || ch(0) === "'") {
          quoteChar = ch(0);
          emit(TokenType.HtmlQuoteOpen, 1);
          pushMode(Mode.QuotedValue);
          continue;
        }

        startText();
        pos++;
        break;
      }

      case Mode.QuotedValue: {
        if (scanLiquidOpen()) continue;

        if (ch(0) === quoteChar) {
          emit(TokenType.HtmlQuoteClose, 1);
          popMode();
          continue;
        }

        startText();
        pos++;
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

enum Mode {
  Default = 'Default',
  HtmlTag = 'HtmlTag',
  QuotedValue = 'QuotedValue',
  LiquidTag = 'LiquidTag',
  LiquidVariableOutput = 'LiquidVariableOutput',
}
