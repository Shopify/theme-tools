import { assertNever } from '../utils';
import { findRawBodyEnd, liquidTagTokenName } from './raw-body';
import type { RawBodyRuleFor } from './raw-body';
import { TagKind } from '../environment';
import type { Environment, TagDefinition } from '../environment';
import type { RawBodyEnd, RawBodyRule } from '../tag-definitions';

const BUILTIN_RAW_OPEN = /\{%-?\s*(raw|comment|doc|schema|javascript|stylesheet|style)(?=\s|-?%})/g;
const TEMPLATE_MARKUP = /\{[{%]|<|-->/g;
const LIQUID_MARKUP = /\{[{%]/g;
const DOUBLE_QUOTED_MARKUP = /["{]/g;
const SINGLE_QUOTED_MARKUP = /['{]/g;

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
   * (see `ParserBase.ensureRawBoundary`) the leading `---` must NOT be treated
   * as frontmatter.
   */
  skipFrontmatter?: boolean;

  /**
   * Begin tokenizing inside an HTML quoted attribute value, closing on the
   * given quote character (`"` or `'`). When a `{% raw %}` straddles the
   * end-tag boundary *inside* a quoted attribute, the suffix re-tokenize (see
   * `ParserBase.ensureRawBoundary`) must resume in `QuotedValue` mode so the
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
  insideHtmlComment?: boolean;

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
  /** Active registry for bounded AST tokenization, including custom raw tags. */
  rawTags?: Environment;
  /** Builtin AST scans can omit literal bodies and reuse their closing offsets. */
  builtinRawTags?: boolean;
  rawBodyEnds?: RawBodyEnd[];
  parseHtml?: boolean;
}

export function tokenize(source: string, options: TokenizeOptions = {}): Token[] {
  if (options.builtinRawTags && options.rawBodyEnds) options.rawBodyEnds = undefined;
  if (!source.length) return [{ type: TokenType.EndOfInput, start: 0, end: 0 }];
  if (source[0] === '<' && source[1] !== '!')
    return tokenizeWith(source, options, nextTextCandidate);
  // A complete Liquid token has no surrounding lexer context to construct.
  const isTag = source[1] === '%';
  if (
    !options.insideHtmlComment &&
    !options.insideQuotedAttribute &&
    !options.insideHtmlTag &&
    source[0] === '{' &&
    (source[1] === '{' || isTag)
  ) {
    const openEnd = source[2] === '-' ? 3 : 2;
    const close = source.indexOf(isTag ? '%}' : '}}', openEnd);
    if (
      (close === -1 || close + 2 === source.length) &&
      (!isTag ||
        (!options.rawBodyRule && (!options.rawTags || options.builtinRawTags)) ||
        close === -1)
    ) {
      const closeStart =
        close === -1
          ? source.length
          : close > openEnd && source[close - 1] === '-'
            ? close - 1
            : close;
      const tokens: Token[] = [
        {
          type: isTag ? TokenType.LiquidTagOpen : TokenType.LiquidVariableOutputOpen,
          start: 0,
          end: openEnd,
        },
      ];
      if (closeStart > openEnd)
        tokens.push({ type: TokenType.Text, start: openEnd, end: closeStart });
      if (close !== -1)
        tokens.push({
          type: isTag ? TokenType.LiquidTagClose : TokenType.LiquidVariableOutputClose,
          start: closeStart,
          end: close + 2,
        });
      tokens.push({ type: TokenType.EndOfInput, start: source.length, end: source.length });
      return tokens;
    }
    return tokenizeLiquidPrefix(source, options, close);
  }
  if (
    !options.rawText &&
    !options.insideHtmlComment &&
    !options.insideQuotedAttribute &&
    !options.insideHtmlTag &&
    source.startsWith('<!--') &&
    source[4] !== '>' &&
    !source.startsWith('->', 4) &&
    source.indexOf('-->', 4) === source.length - 3 &&
    source.indexOf('--!>', 4) === -1 &&
    source.indexOf('<', 4) === -1 &&
    source.indexOf('{', 4) === -1
  ) {
    const end = source.length - 3;
    const tokens: Token[] = [{ type: TokenType.HtmlCommentOpen, start: 0, end: 4 }];
    if (end > 4) tokens.push({ type: TokenType.Text, start: 4, end });
    tokens.push({ type: TokenType.HtmlCommentClose, start: end, end: source.length });
    tokens.push({ type: TokenType.EndOfInput, start: source.length, end: source.length });
    return tokens;
  }
  if (
    !options.insideHtmlComment &&
    !options.insideQuotedAttribute &&
    !options.insideHtmlTag &&
    source[0] !== '{' &&
    source[0] !== '<' &&
    source[0] !== '-'
  ) {
    const markup = options.rawText ? LIQUID_MARKUP : TEMPLATE_MARKUP;
    markup.lastIndex = 0;
    const first = markup.exec(source);
    if (!first)
      return [
        { type: TokenType.Text, start: 0, end: source.length },
        { type: TokenType.EndOfInput, start: source.length, end: source.length },
      ];
    // Resume at the first delimiter instead of scanning the text prefix again.
    return tokenizeWith(
      source,
      options,
      nextTextCandidate,
      [{ type: TokenType.Text, start: 0, end: first.index }],
      first.index,
    );
  }
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

// Liquid prefixes need no HTML mode stack until they reach HTML markup.
function tokenizeLiquidPrefix(
  source: string,
  options: TokenizeOptions,
  firstClose: number,
): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let nextRawOpen = -1;
  let nextRawName = '';
  let open = 0;
  while (pos < source.length) {
    const isTag = source[open + 1] === '%';
    pos = open + (source[open + 2] === '-' ? 3 : 2);
    const close = open === 0 ? firstClose : source.indexOf(isTag ? '%}' : '}}', pos);
    let rawEnd: RawBodyEnd | undefined;
    if (isTag && options.rawTags && options.builtinRawTags) {
      if (nextRawOpen < open) {
        BUILTIN_RAW_OPEN.lastIndex = open;
        const raw = BUILTIN_RAW_OPEN.exec(source);
        nextRawOpen = raw?.index ?? Infinity;
        nextRawName = raw?.[1] ?? '';
      }
      if (nextRawOpen === open) {
        const definition = options.rawTags.tagForName(nextRawName);
        if (definition?.kind === TagKind.Raw && !definition.parseLiquidInBody && close !== -1) {
          rawEnd =
            findRawBodyEnd(source, close + 2, nextRawName, definition.body, (name) => {
              const inner = options.rawTags!.tagForName(name);
              return inner?.kind === TagKind.Raw ? inner.body : undefined;
            }) ?? undefined;
        }
        if (!rawEnd) return tokenizeWith(source, options, nextTextCandidate, tokens, open);
        nextRawOpen = rawEnd.tagEnd - 1;
      }
    }
    tokens.push({
      type: isTag ? TokenType.LiquidTagOpen : TokenType.LiquidVariableOutputOpen,
      start: open,
      end: pos,
    });
    const textEnd =
      close === -1 ? source.length : close > pos && source[close - 1] === '-' ? close - 1 : close;
    if (pos < textEnd) tokens.push({ type: TokenType.Text, start: pos, end: textEnd });
    if (close === -1) break;
    const closeToken = {
      type: isTag ? TokenType.LiquidTagClose : TokenType.LiquidVariableOutputClose,
      start: textEnd,
      end: close + 2,
    };
    tokens.push(closeToken);
    if (isTag && (options.rawBodyRule || (options.rawTags && !options.builtinRawTags))) {
      let name: string | undefined;
      if (options.rawBodyRule) name = liquidTagTokenName(source.slice(open, close + 2));
      else {
        const text = source.slice(open + (source[open + 2] === '-' ? 3 : 2), textEnd).trim();
        const space = text.search(/\s/);
        name = space === -1 ? text : text.slice(0, space);
      }
      const definition = name === undefined ? undefined : options.rawTags?.tagForName(name);
      const rule =
        name === undefined
          ? undefined
          : (options.rawBodyRule?.(name) ??
            (definition?.kind === TagKind.Raw ? definition.body : undefined));
      if (rule)
        return tokenizeWith(source, options, nextTextCandidate, tokens, close + 2, {
          start: open,
          name: name!,
          rule,
          definition,
        });
    }
    if (rawEnd) (options.rawBodyEnds ??= [])[tokens.length - 1] = rawEnd;
    pos = rawEnd?.tagEnd ?? close + 2;
    if (pos === source.length) break;
    if (source[pos] === '{' && (source[pos + 1] === '{' || source[pos + 1] === '%')) {
      open = pos;
      continue;
    }
    TEMPLATE_MARKUP.lastIndex = pos;
    const match = TEMPLATE_MARKUP.exec(source);
    open = match?.index ?? source.length;
    if (pos < open) tokens.push({ type: TokenType.Text, start: pos, end: open });
    if (!match) break;
    if (match[0] !== '{{' && match[0] !== '{%')
      return tokenizeWith(source, options, nextTextCandidate, tokens, open);
  }
  tokens.push({ type: TokenType.EndOfInput, start: source.length, end: source.length });
  return tokens;
}

type NextTextCandidate = (
  source: string,
  from: number,
  mode: Mode,
  quoteChar: string,
  textIsSpace: boolean,
) => number;

interface RawTagStart {
  start: number;
  name: string;
  rule: RawBodyRule;
  definition?: TagDefinition;
}

function tokenizeWith(
  source: string,
  options: TokenizeOptions,
  nextCandidate: NextTextCandidate,
  tokens: Token[] = [],
  initialPos = 0,
  initialRawTag?: RawTagStart,
): Token[] {
  const modeStack: Mode[] = [];
  let mode = Mode.Default as Mode;
  let pos = initialPos;
  let textStart = -1;
  if (initialPos > 0 && tokens[tokens.length - 1]?.type === TokenType.Text) {
    textStart = tokens.pop()!.start;
  }
  let lexicalSource = source;
  let unresolvedRawTags: Map<string, Set<number>> | undefined;
  let literalBodyEnd = -1;
  let nextRawOpen = -1;
  let nextRawName = '';
  let rawBodies:
    | {
        end: RawBodyEnd;
        mode: Mode;
        depth: number;
        quote: string;
        rawTextTag: string;
      }[]
    | undefined;
  // Whether the pending Text run is whitespace. Only HtmlTag mode reads it.
  let textIsSpace = false;
  let quoteChar = '';
  // Where the current comment's body starts, for the spec's empty comments
  // `<!-->` and `<!--->`, which close only right after `<!--`.
  let commentBodyStart = -1;
  // Where the `{%` of the Liquid tag being tokenized starts.
  let liquidTagStart = -1;
  let insideDoctype = false;
  // SVG bodies preserve markup tokens, including nested SVG elements. Comments
  // there must not hide the close used by the parser's depth-balanced scanner.
  let inSvg = 0;
  // The element whose open tag is being tokenized, when it is `svg`, `script`
  // or `style`: the tag's `>` opens it.
  let pendingElement: 'svg' | 'script' | 'style' | undefined;
  // The `<script>` or `<style>` whose body is being tokenized in RawText mode,
  // or "" when the input is a body passed with `rawText` (no close tag).
  let rawTextTag = '';

  // Resume inside a quoted attribute value when reslicing a suffix that begins
  // mid-attribute (e.g. `...{% endraw %}">` straddled by a stray `{{`). The
  // enclosing HtmlTag mode is kept beneath QuotedValue so popping on the
  // closing quote correctly emits the attribute close and trailing `>`.
  if (options.insideHtmlComment) {
    mode = Mode.HtmlComment;
  } else if (options.insideQuotedAttribute) {
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

  function ch(offset: number): string {
    const i = pos + offset;
    return i < lexicalSource.length ? source[i] : '';
  }

  function match(s: string): boolean {
    return lexicalSource.startsWith(s, pos);
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
  if (pos === 0 && !options.skipFrontmatter && (match('---\n') || match('---\r\n'))) {
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

  // Every caller already checked the opening `{`.
  function scanLiquidOpen(): boolean {
    const next = lexicalSource[pos + 1];
    if (next === '{') {
      emit(TokenType.LiquidVariableOutputOpen, lexicalSource[pos + 2] === '-' ? 3 : 2);
      pushMode(Mode.LiquidVariableOutput);
      return true;
    }
    if (next === '%') {
      liquidTagStart = pos;
      emit(TokenType.LiquidTagOpen, lexicalSource[pos + 2] === '-' ? 3 : 2);
      pushMode(Mode.LiquidTag);
      return true;
    }
    return false;
  }

  // Bound the body once, preserving the surrounding mode and caching its close
  // for the AST. Literal bodies cannot change HTML or attribute context.
  function skipRawBody(known?: RawTagStart) {
    if (
      (!options.rawTags && !options.rawBodyRule) ||
      (insideDoctype && options.parseHtml !== false) ||
      pos <= literalBodyEnd
    )
      return;
    let name: string | undefined;
    if (known) {
      name = known.name;
    } else if (options.builtinRawTags) {
      if (nextRawOpen < liquidTagStart) {
        BUILTIN_RAW_OPEN.lastIndex = liquidTagStart;
        const match = BUILTIN_RAW_OPEN.exec(source);
        nextRawOpen = match?.index ?? Infinity;
        nextRawName = match?.[1] ?? '';
      }
      if (nextRawOpen !== liquidTagStart) return;
      nextRawOpen = liquidTagStart + 1;
      name = nextRawName;
    } else if (options.rawTags) {
      const close = tokens[tokens.length - 1];
      const text = source
        .slice(liquidTagStart + (source[liquidTagStart + 2] === '-' ? 3 : 2), close.start)
        .trim();
      const space = text.search(/\s/);
      name = space === -1 ? text : text.slice(0, space);
    } else {
      name = liquidTagTokenName(source.slice(liquidTagStart, pos));
    }
    if (name === undefined) return;
    const definition = known?.definition ?? options.rawTags?.tagForName(name);
    const rule =
      known?.rule ??
      options.rawBodyRule?.(name) ??
      (definition?.kind === TagKind.Raw ? definition.body : undefined);
    if (!rule) return;
    const ruleFor =
      options.rawBodyRule ??
      ((name: string) => {
        const inner = options.rawTags?.tagForName(name);
        return inner?.kind === TagKind.Raw ? inner.body : undefined;
      });
    if (unresolvedRawTags?.get(name)?.has(lexicalSource.length)) return;
    const end = findRawBodyEnd(lexicalSource, pos, name, rule, ruleFor);
    if (!end) {
      unresolvedRawTags ??= new Map();
      const bounds = unresolvedRawTags.get(name) ?? new Set<number>();
      bounds.add(lexicalSource.length);
      unresolvedRawTags.set(name, bounds);
      return;
    }
    if (options.builtinRawTags) {
      (options.rawBodyEnds ??= [])[tokens.length - 1] = end;
      if (definition?.kind === TagKind.Raw && !definition.parseLiquidInBody) {
        pos = end.tagEnd;
        return;
      }
    }
    // Plain bodies and one unfinished output need no additional lexer mode.
    LIQUID_MARKUP.lastIndex = pos;
    const first = LIQUID_MARKUP.exec(source);
    if (!first || first.index + 2 > end.tagStart) {
      if (pos < end.tagStart) emit(TokenType.Text, end.tagStart - pos);
      return;
    }
    const bodySource = source.slice(0, end.tagStart);
    const openEnd = first.index + (bodySource[first.index + 2] === '-' ? 3 : 2);
    if (first[0] === '{{' && bodySource.indexOf('}}', openEnd) === -1) {
      if (pos < first.index) emit(TokenType.Text, first.index - pos);
      emit(TokenType.LiquidVariableOutputOpen, openEnd - first.index);
      if (pos < end.tagStart) emit(TokenType.Text, end.tagStart - pos);
      return;
    }
    (rawBodies ??= []).push({ end, mode, depth: modeStack.length, quote: quoteChar, rawTextTag });
    if (definition?.kind === TagKind.Raw && !definition.parseLiquidInBody)
      literalBodyEnd = end.tagStart;
    lexicalSource = bodySource;
    mode = Mode.RawText;
    rawTextTag = '';
  }

  function resumeRawBody(): boolean {
    if (!rawBodies) return false;
    while (pos >= lexicalSource.length) {
      const body = rawBodies.pop();
      if (!body) return false;
      flushText();
      mode = body.mode;
      modeStack.length = body.depth;
      quoteChar = body.quote;
      rawTextTag = body.rawTextTag;
      const parent = rawBodies[rawBodies.length - 1];
      lexicalSource = parent ? source.slice(0, parent.end.tagStart) : source;
    }
    return true;
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
      inSvg++;
    } else if (element !== undefined && !inSvg && mode === Mode.Default) {
      rawTextTag = element;
      pushMode(Mode.RawText);
    }
  }

  if (initialRawTag) {
    liquidTagStart = initialRawTag.start;
    skipRawBody(initialRawTag);
  }
  while (pos < lexicalSource.length || resumeRawBody()) {
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
          pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
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
          pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
        }
        break;
      }

      case Mode.Default: {
        const code = lexicalSource.charCodeAt(pos);
        if (code === CHAR_OPEN_BRACE && scanLiquidOpen()) continue;

        // Inside an `<svg>`, `<!--` and `-->` are the one-off tokens they were
        // before comment mode, and open no mode.
        if (code === CHAR_LESS_THAN && match('<!--') && inSvg) {
          emit(TokenType.HtmlCommentOpen, 4);
          continue;
        }

        if (code === CHAR_DASH && match('-->') && inSvg) {
          emit(TokenType.HtmlCommentClose, 3);
          continue;
        }

        if (code === CHAR_LESS_THAN && match('<!--')) {
          emit(TokenType.HtmlCommentOpen, 4);
          pushMode(Mode.HtmlComment);
          commentBodyStart = pos;
          continue;
        }

        if (code === CHAR_LESS_THAN && match('<!')) {
          insideDoctype = true;
          emit(TokenType.HtmlDoctypeOpen, 2);
          pushMode(Mode.HtmlTag);
          continue;
        }

        if (code === CHAR_LESS_THAN && match('</')) {
          if (isTagNameStart(source.charCodeAt(pos + 2))) {
            if (inSvg && closesSvg(pos)) inSvg--;
            emit(TokenType.HtmlCloseTagOpen, 2);
            pushMode(Mode.HtmlTag);
            continue;
          }
        }

        if (code === CHAR_LESS_THAN) {
          if (isTagNameStart(source.charCodeAt(pos + 1))) {
            pendingElement = elementNameAt(pos + 1);
            emit(TokenType.HtmlTagOpen, 1);
            pushMode(Mode.HtmlTag);
            continue;
          }
        }

        startText();
        pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
        break;
      }

      case Mode.HtmlTag: {
        const code = lexicalSource.charCodeAt(pos);
        if (code === CHAR_OPEN_BRACE && scanLiquidOpen()) continue;

        if (code === CHAR_SLASH && match('/>')) {
          emit(TokenType.HtmlSelfClose, 2);
          popMode();
          pendingElement = undefined;
          continue;
        }

        if (code === CHAR_GREATER_THAN) {
          emit(TokenType.HtmlTagClose, 1);
          popMode();
          insideDoctype = false;
          openPendingElement();
          continue;
        }

        if (code === CHAR_EQUALS) {
          emit(TokenType.HtmlEquals, 1);
          continue;
        }

        if (code === CHAR_DOUBLE_QUOTE || code === CHAR_SINGLE_QUOTE || isSmartQuote(code)) {
          quoteChar = ch(0);
          emit(TokenType.HtmlQuoteOpen, 1);
          pushMode(Mode.QuotedValue);
          continue;
        }

        // A run of whitespace inside a tag is a Text token of its own, never
        // part of a name or an unquoted value. It plays the part of ohm's
        // `space`, which the grammar's syntactic attribute rules skipped
        // implicitly (`attr = "v"` is one attribute).
        const isSpace = isWhitespace(code);
        if (textStart !== -1 && isSpace !== textIsSpace) flushText();
        if (textStart === -1) textIsSpace = isSpace;
        startText();
        pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
        break;
      }

      case Mode.QuotedValue: {
        const code = lexicalSource.charCodeAt(pos);
        if (code === CHAR_OPEN_BRACE && scanLiquidOpen()) continue;

        if (code === quoteChar.charCodeAt(0) || code === closingQuoteFor(quoteChar).charCodeAt(0)) {
          emit(TokenType.HtmlQuoteClose, 1);
          popMode();
          continue;
        }

        startText();
        pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
        break;
      }

      case Mode.HtmlComment: {
        const code = lexicalSource.charCodeAt(pos);
        // A comment's body is text, except for Liquid, which still renders
        // inside it, and the comment's close. Markup in the body (`<b`, an
        // unbalanced quote, a nested `<!--`) is text, as it is to a browser, so
        // it can't open a tag that swallows the close.
        if (code === CHAR_OPEN_BRACE && scanLiquidOpen()) continue;

        // The HTML spec closes `<!-->` and `<!--->` as empty comments
        // ("abrupt-closing-of-empty-comment"). This applies only right after
        // `<!--`; anywhere later, `>` and `->` are text.
        if (pos === commentBodyStart) {
          if (code === CHAR_GREATER_THAN) {
            emit(TokenType.HtmlCommentClose, 1);
            popMode();
            continue;
          }
          if (code === CHAR_DASH && match('->')) {
            emit(TokenType.HtmlCommentClose, 2);
            popMode();
            continue;
          }
        }

        if (code === CHAR_DASH && match('-->')) {
          emit(TokenType.HtmlCommentClose, 3);
          popMode();
          continue;
        }

        // `--!>` closes a comment too ("incorrectly-closed-comment").
        if (code === CHAR_DASH && match('--!>')) {
          emit(TokenType.HtmlCommentClose, 4);
          popMode();
          continue;
        }

        startText();
        pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
        break;
      }

      case Mode.RawText: {
        const code = lexicalSource.charCodeAt(pos);
        // A `<script>` or `<style>` body is text, except for Liquid, which
        // still renders inside it, and the element's close tag. A `<!--`, a
        // `<svg`, or a quote in the body is text, as it is to a browser.
        if (code === CHAR_OPEN_BRACE && scanLiquidOpen()) continue;

        if (code === CHAR_LESS_THAN && match('</') && closesRawText(pos)) {
          popMode();
          rawTextTag = '';
          emit(TokenType.HtmlCloseTagOpen, 2);
          pushMode(Mode.HtmlTag);
          continue;
        }

        startText();
        pos = nextCandidate(lexicalSource, pos + 1, mode, quoteChar, textIsSpace);
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
 * consumed in one step. Inside an HTML tag a run also ends where text switches
 * between whitespace and non-whitespace, because each is its own Text token.
 * Returning a superset of real token starts is safe: the main loop re-checks
 * that position and treats a non-match as text. Missing a token start is not,
 * so a new token type needs its first character added to its mode's helper
 * (tokenizer.test.ts compares against `tokenizeWithoutFastPath` to catch this).
 */

function nextTextCandidate(
  source: string,
  from: number,
  mode: Mode,
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
      return nextLiquidCloseCandidate(source, from, '%}');
    case Mode.LiquidVariableOutput:
      return nextLiquidCloseCandidate(source, from, '}}');
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

/**
 * HtmlTag mode tokens start with `{`, `/`, `>`, `=`, or a quote; a Text run
 * also ends where whitespace starts or stops.
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
      isSmartQuote(c) ||
      isWhitespace(c) !== textIsSpace
    ) {
      return i;
    }
  }
  return source.length;
}

/** QuotedValue mode tokens start with `{` or the closing quote. */
function nextQuotedValueCandidate(source: string, from: number, quoteChar: string): number {
  const quote = quoteChar.charCodeAt(0);
  const partner = closingQuoteFor(quoteChar).charCodeAt(0);
  const prefixEnd = Math.min(from + 16, source.length);
  for (let i = from; i < prefixEnd; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === quote || c === partner) return i;
  }
  if (prefixEnd === source.length) return prefixEnd;
  const markup =
    quoteChar === '"' ? DOUBLE_QUOTED_MARKUP : quoteChar === "'" ? SINGLE_QUOTED_MARKUP : undefined;
  if (markup) {
    markup.lastIndex = prefixEnd;
    return markup.exec(source)?.index ?? source.length;
  }
  for (let i = prefixEnd; i < source.length; i++) {
    const c = source.charCodeAt(i);
    if (c === CHAR_OPEN_BRACE || c === quote || c === partner) return i;
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

/** Exactly the UTF-16 code units JavaScript's `\s` matches. */
function isWhitespace(c: number): boolean {
  if (c < 0xa0) return c === 0x20 || (c >= 0x09 && c <= 0x0d);
  return (
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

function isSmartQuote(code: number): boolean {
  return code === 0x2018 || code === 0x2019 || code === 0x201c || code === 0x201d;
}

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
