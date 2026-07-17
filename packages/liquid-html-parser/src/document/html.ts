import { TokenType } from './tokenizer';
import { ParserBase } from './base';
import {
  makeTextNode,
  makeRawMarkup,
  makeHtmlElement,
  makeHtmlVoidElement,
  makeHtmlSelfClosingElement,
  makeHtmlRawNode,
  makeHtmlComment,
  makeHtmlDoctype,
  makeHtmlDanglingMarkerClose,
  makeAttrDoubleQuoted,
  makeAttrSingleQuoted,
  makeAttrUnquoted,
  makeAttrEmpty,
} from './factories';
import { ChildFilterMode, filterChildren, compoundNamesMatch } from './tree-builder';
import { NodeTypes } from '../types';
import type { Position } from '../types';
import { RawMarkupKinds } from '../ast';
import type {
  LiquidHtmlNode,
  LiquidVariableOutput,
  LiquidRawTag,
  LiquidTag,
  TextNode,
  HtmlElement,
  HtmlVoidElement,
  HtmlSelfClosingElement,
  HtmlRawNode,
  HtmlComment,
  HtmlDoctype,
  HtmlDanglingMarkerClose,
  AttributeNode,
  AttrDoubleQuoted,
  AttrSingleQuoted,
  AttrUnquoted,
  ValueNode,
  LiquidNode,
  CompoundNameSegment,
} from '../ast';
import { VOID_ELEMENTS, HTML_RAW_TAGS, BLOCKS } from '../grammar';
import { LiquidHTMLASTParsingError } from '../errors';

/**
 * Interface capturing what HTML-parsing free functions need from the
 * DocumentParser.  The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export interface HtmlParserDelegate extends ParserBase {
  readonly htmlParseHtml: boolean;
  htmlAllowUnclosedHtml: boolean;
  htmlInAttributeContext: boolean;
  htmlInAttributeValueContext: boolean;

  parseNode(): LiquidHtmlNode;
  parseLiquidVariableOutput(): LiquidVariableOutput;
  parseLiquidTag(): LiquidTag | LiquidRawTag;
  peekTagName(): string | null;
  isBlockTerminator(): boolean;
  parseBranchAttributes(): AttributeNode[];
  parseLiquidInRange(bodyStart: number, bodyEnd: number): (LiquidNode | TextNode)[];
}

// htmlElement := "<" compoundName attributes ("/" | ">") children? "</" compoundName ">"
export function parseHtmlElement(
  parser: HtmlParserDelegate,
): HtmlElement | HtmlVoidElement | HtmlSelfClosingElement | HtmlRawNode {
  const source = parser.getSource();
  const openTagStart = parser.peek().start;
  parser.consume(TokenType.HtmlTagOpen);

  const name = parseCompoundName(parser);
  const attributes = parseAttributes(parser);

  if (parser.accept(TokenType.HtmlSelfClose)) {
    const openTagEnd = parser.tokenAt(parser.getPosition() - 1).end;
    const blockStartPosition: Position = { start: openTagStart, end: openTagEnd };
    return makeHtmlSelfClosingElement(name, attributes, blockStartPosition, source);
  }

  parser.consume(TokenType.HtmlTagClose);
  const openTagEnd = parser.tokenAt(parser.getPosition() - 1).end;
  const blockStartPosition: Position = { start: openTagStart, end: openTagEnd };

  const plainName = extractPlainName(name);
  if (plainName !== null && VOID_ELEMENTS.includes(plainName.toLowerCase())) {
    return makeHtmlVoidElement(plainName, attributes, blockStartPosition, source);
  }

  if (plainName !== null && HTML_RAW_TAGS.includes(plainName.toLowerCase())) {
    return parseHtmlRawBody(parser, plainName, attributes, blockStartPosition);
  }

  const children: LiquidHtmlNode[] = [];
  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.HtmlCloseTagOpen)) {
      break;
    }
    if (parser.isBlockTerminator()) {
      if (!parser.htmlAllowUnclosedHtml) {
        const tagName = parser.peekTagName()!;
        throw new LiquidHTMLASTParsingError(
          `Attempting to close LiquidTag '${tagName}' before HtmlElement '${plainName || 'compound'}' was closed`,
          source,
          openTagStart,
          openTagEnd,
        );
      }
      break;
    }
    children.push(parser.parseNode());
  }

  if (parser.isAtEnd() || (parser.htmlAllowUnclosedHtml && parser.isBlockTerminator())) {
    if (!parser.htmlAllowUnclosedHtml) {
      throw new LiquidHTMLASTParsingError(
        `Attempting to end parsing before HtmlElement '${plainName || 'compound'}' was closed`,
        source,
        openTagStart,
        openTagEnd,
      );
    }
    const endPos = children.length > 0 ? children[children.length - 1].position.end : openTagEnd;
    const blockEndPosition: Position = { start: endPos, end: endPos };
    const merged = filterChildren(ChildFilterMode.Syntactic, children, source);
    return makeHtmlElement(name, attributes, merged, blockStartPosition, blockEndPosition, source);
  }

  const closeStart = parser.peek().start;
  parser.consume(TokenType.HtmlCloseTagOpen);
  const closeName = parseCompoundName(parser);

  while (parser.check(TokenType.Text)) {
    const text = source.slice(
      parser.tokenAt(parser.getPosition()).start,
      parser.tokenAt(parser.getPosition()).end,
    );
    if (/^\s*$/.test(text)) {
      parser.advance();
    } else {
      break;
    }
  }

  parser.consume(TokenType.HtmlTagClose);
  const closeEnd = parser.tokenAt(parser.getPosition() - 1).end;

  if (!compoundNamesMatch(name, closeName)) {
    const closePlainName = extractPlainName(closeName);
    throw new LiquidHTMLASTParsingError(
      `Attempting to close HtmlElement '${closePlainName || 'compound'}' before HtmlElement '${plainName || 'compound'}' was closed`,
      source,
      closeStart,
      closeEnd,
    );
  }

  const blockEndPosition: Position = { start: closeStart, end: closeEnd };
  const merged = filterChildren(ChildFilterMode.Syntactic, children, source);
  return makeHtmlElement(name, attributes, merged, blockStartPosition, blockEndPosition, source);
}

// htmlRawBody := (text | liquidVariableOutput | liquidTag)* "</" tagName ">"
export function parseHtmlRawBody(
  parser: HtmlParserDelegate,
  plainName: string,
  attributes: AttributeNode[],
  blockStartPosition: Position,
): HtmlRawNode {
  const source = parser.getSource();
  const bodyStart = blockStartPosition.end;

  const closeIdx = scanForHtmlCloseTag(parser, plainName);
  if (closeIdx === -1) {
    throw new LiquidHTMLASTParsingError(
      `Attempting to end parsing before HtmlRawNode '${plainName}' was closed`,
      source,
      blockStartPosition.start,
      blockStartPosition.end,
    );
  }

  const bodyEnd = parser.tokenAt(closeIdx).start;
  const bodyString = source.slice(bodyStart, bodyEnd);

  const bodyNodes = parser.parseLiquidInRange(bodyStart, bodyEnd);

  const kind = rawMarkupKindForHtmlTag(plainName, attributes, bodyString);
  const body = makeRawMarkup(kind, bodyString, bodyNodes, bodyStart, bodyEnd, source);

  // Re-seek to the close tag by its stable source offset (`bodyEnd`) rather than
  // the pre-parse `closeIdx` or wherever the body parse left the cursor:
  //  - `closeIdx` can go stale: a nested raw tag in the body calls
  //    `resliceTokensFrom`, which renumbers the token slots at/after that
  //    boundary, so the cached index would point at the wrong slot.
  //  - the live cursor can over-advance: a `{% if %}` block whose body straddles
  //    the close tag (e.g. `<script>{% if x %}</script>{% endif %}</script>`)
  //    consumes the first `</script>` as text while seeking `{% endif %}`,
  //    leaving the cursor at a *later* close tag.
  // A source offset survives reslicing (offsets are preserved) and pins us to the
  // first `</script>`, which is where the raw element actually closes.
  parser.seekToSourceOffset(bodyEnd);
  const closeStart = parser.peek().start;
  parser.consume(TokenType.HtmlCloseTagOpen);
  while (parser.check(TokenType.Text)) parser.advance();
  const closeEnd = parser.consume(TokenType.HtmlTagClose).end;

  const blockEndPosition: Position = { start: closeStart, end: closeEnd };
  return makeHtmlRawNode(plainName, attributes, body, blockStartPosition, blockEndPosition, source);
}

// htmlComment := "<!--" text* "-->"
export function parseHtmlComment(parser: HtmlParserDelegate): HtmlComment {
  const source = parser.getSource();
  const openToken = parser.consume(TokenType.HtmlCommentOpen);
  const bodyStart = openToken.end;

  // Find the closing `-->` by scanning the source rather than walking tokens.
  // A conditional comment body (`<!--[if IE]>…<![endif]-->`) contains
  // `<![endif]`, which the tokenizer treats as a doctype open — it enters
  // HtmlTag mode and consumes the trailing `-->` as an HtmlTagClose, so no
  // HtmlCommentClose token is ever emitted and the token walk would run to EOF.
  // A source scan pins us to the real comment close, so the (unchanged)
  // HtmlComment node feeds getConditionalComment correctly in the printer.
  const closeIdx = source.indexOf('-->', bodyStart);
  if (closeIdx === -1) {
    throw new LiquidHTMLASTParsingError(
      `Attempting to end parsing before HtmlComment '<!--' was closed`,
      source,
      openToken.start,
      openToken.end,
    );
  }

  const bodyEnd = closeIdx;
  const commentEnd = closeIdx + 3; // past `-->`
  const body = source.slice(bodyStart, bodyEnd).trim();

  parser.seekToSourceOffset(commentEnd);

  return makeHtmlComment(body, openToken.start, commentEnd, source);
}

// htmlDoctype := "<!" text ">"
export function parseHtmlDoctype(parser: HtmlParserDelegate): HtmlDoctype {
  const source = parser.getSource();
  const openToken = parser.consume(TokenType.HtmlDoctypeOpen);

  while (!parser.isAtEnd() && !parser.check(TokenType.HtmlTagClose)) {
    parser.advance();
  }

  const closeToken = parser.consume(TokenType.HtmlTagClose);
  const body = source.slice(openToken.end, closeToken.start).trim();

  const match = body.match(/^doctype\s+html\s*(.*)/i);
  const legacyDoctypeString = match ? (match[1].length > 0 ? match[1] : null) : body;

  return makeHtmlDoctype(legacyDoctypeString, openToken.start, closeToken.end, source);
}

export function parseOrphanedHtmlCloseTag(parser: HtmlParserDelegate): never {
  const source = parser.getSource();
  const closeStart = parser.peek().start;
  parser.consume(TokenType.HtmlCloseTagOpen);
  const closeName = parseCompoundName(parser);
  while (parser.check(TokenType.Text)) {
    const text = source.slice(
      parser.tokenAt(parser.getPosition()).start,
      parser.tokenAt(parser.getPosition()).end,
    );
    if (/^\s*$/.test(text)) {
      parser.advance();
    } else {
      break;
    }
  }
  const closeEnd = parser.consume(TokenType.HtmlTagClose).end;
  const plainCloseName = extractPlainName(closeName);
  throw new LiquidHTMLASTParsingError(
    `Attempting to close HtmlElement '${plainCloseName || 'compound'}' before it was opened`,
    source,
    closeStart,
    closeEnd,
  );
}

export function parseHtmlDanglingMarkerClose(parser: HtmlParserDelegate): HtmlDanglingMarkerClose {
  const source = parser.getSource();
  const start = parser.peek().start;
  parser.consume(TokenType.HtmlCloseTagOpen);
  const name = parseCompoundName(parser);
  while (parser.check(TokenType.Text)) {
    const text = source.slice(
      parser.tokenAt(parser.getPosition()).start,
      parser.tokenAt(parser.getPosition()).end,
    );
    if (/^\s*$/.test(text)) {
      parser.advance();
    } else {
      break;
    }
  }
  parser.consume(TokenType.HtmlTagClose);
  const end = parser.tokenAt(parser.getPosition() - 1).end;
  return makeHtmlDanglingMarkerClose(name, start, end, source);
}

/**
 * Parse attributes until a block terminator (end tag, branch keyword) is encountered.
 * Used inside Liquid tag branches that appear in HTML attribute context.
 */
export function parseBranchAttributesImpl(parser: HtmlParserDelegate): AttributeNode[] {
  const attrs: AttributeNode[] = [];
  const source = parser.getSource();

  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.HtmlTagClose) || parser.check(TokenType.HtmlSelfClose)) break;
    if (parser.isBlockTerminator()) break;

    // Skip leading whitespace in text tokens
    if (parser.check(TokenType.Text)) {
      const token = parser.tokenAt(parser.getPosition());
      const text = source.slice(token.start, token.end);
      if (/^\s+$/.test(text)) {
        parser.advance();
        continue;
      }
      const leadingWs = text.search(/\S/);
      if (leadingWs > 0) {
        token.start = token.start + leadingWs;
      }
    }

    if (parser.check(TokenType.LiquidTagOpen)) {
      const saved = parser.htmlInAttributeContext;
      parser.htmlInAttributeContext = true;
      attrs.push(parser.parseLiquidTag() as unknown as AttributeNode);
      parser.htmlInAttributeContext = saved;
      continue;
    }

    if (parser.check(TokenType.LiquidVariableOutputOpen)) {
      attrs.push(parser.parseLiquidVariableOutput() as unknown as AttributeNode);
      continue;
    }

    const attrStart = parser.peek().start;
    const name = parseCompoundName(parser);
    if (name.length === 0) {
      parser.advance();
      continue;
    }

    if (parser.accept(TokenType.HtmlEquals)) {
      const quoteToken = parser.accept(TokenType.HtmlQuoteOpen);
      if (quoteToken) {
        const quoteChar = source[quoteToken.start];
        const valueStart = quoteToken.end;
        const value = parseQuotedAttributeValue(parser);
        const closeQuote = parser.consume(TokenType.HtmlQuoteClose);
        const valueEnd = closeQuote.start;
        const attrEnd = closeQuote.end;
        const attributePosition: Position = { start: valueStart, end: valueEnd };

        if (quoteChar === '"') {
          attrs.push(
            makeAttrDoubleQuoted(name, value, attributePosition, attrStart, attrEnd, source),
          );
        } else {
          attrs.push(
            makeAttrSingleQuoted(name, value, attributePosition, attrStart, attrEnd, source),
          );
        }
      } else {
        const { value, end: valueEnd } = parseUnquotedAttributeValue(parser);
        const attributePosition: Position = {
          start: value.length > 0 ? value[0].position.start : parser.peek().start,
          end: valueEnd,
        };
        attrs.push(makeAttrUnquoted(name, value, attributePosition, attrStart, valueEnd, source));
      }
    } else {
      const lastSegment = name[name.length - 1];
      const attrEnd = lastSegment.position.end;
      attrs.push(makeAttrEmpty(name, attrStart, attrEnd, source));
    }
  }

  return attrs;
}

// compoundName := (text | liquidVariableOutput | liquidTag)+
export function parseCompoundName(parser: HtmlParserDelegate): CompoundNameSegment[] {
  const segments: CompoundNameSegment[] = [];

  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.LiquidVariableOutputOpen)) {
      segments.push(parser.parseLiquidVariableOutput());
      continue;
    }

    // Consume {% ... %} tags as part of the compound name (e.g.
    // <{% if cond %}sticky-header{% else %}div{% endif %}>), but NOT when
    // the name is already a complete LiquidVariableOutput like {{ tag }} —
    // in that case the {% if %} belongs to the attribute context (e.g.
    // <{{ tag }}{% if class %} class="..."{% endif %}>). Once a literal text
    // name has been established, `liquidTagStartsAttributeList` decides whether
    // a glued tag continues the name or opens the attribute list.
    if (
      !parser.htmlInAttributeContext &&
      parser.check(TokenType.LiquidTagOpen) &&
      !segments.some((s) => s.type === NodeTypes.LiquidVariableOutput) &&
      !liquidTagStartsAttributeList(parser, segments)
    ) {
      segments.push(parser.parseLiquidTag());
      continue;
    }

    const prefix = consumeTextPrefix(parser);
    if (prefix !== null) {
      segments.push(prefix);
      continue;
    }

    break;
  }

  return segments;
}

// attributes := (attribute | liquidVariableOutput | liquidTag)*
export function parseAttributes(parser: HtmlParserDelegate): AttributeNode[] {
  // We are past the element's (possibly compound) tag name and now inside its
  // attribute list. Mark attribute context so a Liquid tag glued directly to an
  // attribute name (e.g. `data-dock{% if x %} data-foo{% endif %}`) is parsed as a
  // separate attribute-position Liquid tag instead of being swallowed into the
  // attribute name by parseCompoundName. Otherwise the `{% if %}` block becomes part
  // of the attribute name, later renders to an invalid DOM attribute name, and
  // crashes the canvas. Compound *tag* names (parsed before this) still accept
  // conditionals like `<{% if x %}a{% endif %}>`.
  const savedAttrContext = parser.htmlInAttributeContext;
  parser.htmlInAttributeContext = true;
  try {
    return parseAttributeList(parser);
  } finally {
    parser.htmlInAttributeContext = savedAttrContext;
  }
}

function parseAttributeList(parser: HtmlParserDelegate): AttributeNode[] {
  const attrs: AttributeNode[] = [];
  const source = parser.getSource();

  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.HtmlTagClose) || parser.check(TokenType.HtmlSelfClose)) break;

    // Skip leading whitespace in text tokens
    if (parser.check(TokenType.Text)) {
      const token = parser.tokenAt(parser.getPosition());
      const text = source.slice(token.start, token.end);
      if (/^\s+$/.test(text)) {
        parser.advance();
        continue;
      }
      // If text starts with whitespace, skip past it by mutating token.start
      const leadingWs = text.search(/\S/);
      if (leadingWs > 0) {
        token.start = token.start + leadingWs;
      }
    }

    // Liquid tag between attributes
    if (parser.check(TokenType.LiquidTagOpen)) {
      const saved = parser.htmlInAttributeContext;
      parser.htmlInAttributeContext = true;
      attrs.push(parser.parseLiquidTag() as unknown as AttributeNode);
      parser.htmlInAttributeContext = saved;
      continue;
    }

    // Liquid drop between attributes
    if (parser.check(TokenType.LiquidVariableOutputOpen)) {
      attrs.push(parser.parseLiquidVariableOutput() as unknown as AttributeNode);
      continue;
    }

    const attrStart = parser.peek().start;
    const name = parseCompoundName(parser);
    if (name.length === 0) {
      parser.advance();
      continue;
    }

    if (parser.accept(TokenType.HtmlEquals)) {
      const quoteToken = parser.accept(TokenType.HtmlQuoteOpen);
      if (quoteToken) {
        const quoteChar = source[quoteToken.start];
        const valueStart = quoteToken.end;
        const value = parseQuotedAttributeValue(parser);
        const closeQuote = parser.consume(TokenType.HtmlQuoteClose);
        const valueEnd = closeQuote.start;
        const attrEnd = closeQuote.end;
        const attributePosition: Position = { start: valueStart, end: valueEnd };

        // Double straight quote and double curly quotes (“ ”) map to a
        // double-quoted attr; single straight quote and single curly quotes
        // (‘ ’) map to a single-quoted attr. The printer normalizes the curly
        // variants to straight quotes.
        if (quoteChar === '"' || quoteChar === '“' || quoteChar === '”') {
          attrs.push(
            makeAttrDoubleQuoted(name, value, attributePosition, attrStart, attrEnd, source),
          );
        } else {
          attrs.push(
            makeAttrSingleQuoted(name, value, attributePosition, attrStart, attrEnd, source),
          );
        }
      } else {
        const { value, end: valueEnd } = parseUnquotedAttributeValue(parser);
        const attributePosition: Position = {
          start: value.length > 0 ? value[0].position.start : parser.peek().start,
          end: valueEnd,
        };
        attrs.push(makeAttrUnquoted(name, value, attributePosition, attrStart, valueEnd, source));
      }
    } else {
      const lastSegment = name[name.length - 1];
      const attrEnd = lastSegment.position.end;
      attrs.push(makeAttrEmpty(name, attrStart, attrEnd, source));
    }
  }

  return attrs;
}

// quotedAttrValue := (text | liquidVariableOutput | liquidTag)*
export function parseQuotedAttributeValue(parser: HtmlParserDelegate): ValueNode[] {
  const values: ValueNode[] = [];
  const source = parser.getSource();

  while (!parser.isAtEnd() && !parser.check(TokenType.HtmlQuoteClose)) {
    if (parser.check(TokenType.LiquidVariableOutputOpen)) {
      values.push(parser.parseLiquidVariableOutput());
    } else if (parser.check(TokenType.LiquidTagOpen)) {
      // Detect branch/end keywords inside quoted attribute values -- this is invalid
      const tagName = parser.peekTagName();
      if (tagName && (BRANCH_KEYWORDS.has(tagName) || tagName.startsWith('end'))) {
        const token = parser.peek();
        throw new LiquidHTMLASTParsingError(
          `Unexpected Liquid tag '${tagName}' inside quoted attribute value`,
          source,
          token.start,
          token.end,
        );
      }
      const saved = parser.htmlInAttributeValueContext;
      parser.htmlInAttributeValueContext = true;
      values.push(parser.parseLiquidTag());
      parser.htmlInAttributeValueContext = saved;
    } else if (parser.check(TokenType.Text)) {
      const token = parser.advance();
      values.push(
        makeTextNode(source.slice(token.start, token.end), token.start, token.end, source),
      );
    } else {
      break;
    }
  }

  return values;
}

// unquotedAttrValue := (text | liquidVariableOutput)+
export function parseUnquotedAttributeValue(parser: HtmlParserDelegate): {
  value: ValueNode[];
  end: number;
} {
  const values: ValueNode[] = [];
  let end = parser.peek().start;

  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.HtmlTagClose) || parser.check(TokenType.HtmlSelfClose)) break;

    if (parser.check(TokenType.Text)) {
      const token = parser.tokenAt(parser.getPosition());
      const source = parser.getSource();
      const text = source.slice(token.start, token.end);
      if (/^\s/.test(text)) break;

      const prefix = consumeTextPrefix(parser);
      if (prefix) {
        values.push(prefix);
        end = prefix.position.end;
        continue;
      }
      break;
    }

    if (parser.check(TokenType.LiquidVariableOutputOpen)) {
      const drop = parser.parseLiquidVariableOutput();
      values.push(drop);
      end = drop.position.end;
      continue;
    }

    break;
  }

  return { value: values, end };
}

/**
 * Consume the non-whitespace prefix of the current Text token.
 * If the token starts with whitespace, returns null (no name content).
 * If the entire token has no whitespace, consumes it entirely.
 * If whitespace is in the middle, mutates token.start to the whitespace
 * offset so the remainder stays for attribute parsing.
 */
export function consumeTextPrefix(parser: HtmlParserDelegate): TextNode | null {
  if (!parser.check(TokenType.Text)) return null;
  const token = parser.tokenAt(parser.getPosition());
  const source = parser.getSource();
  const text = source.slice(token.start, token.end);
  const wsIndex = text.search(/\s/);

  if (wsIndex === 0) return null;

  if (wsIndex === -1) {
    parser.advance();
    return makeTextNode(text, token.start, token.end, source);
  }

  const result = makeTextNode(text.slice(0, wsIndex), token.start, token.start + wsIndex, source);
  token.start = token.start + wsIndex;
  return result;
}

/**
 * Decide whether a `{% ... %}` tag glued to an in-progress compound name opens
 * the element's attribute list rather than continuing the name. The parser must
 * be positioned on the tag's `LiquidTagOpen`.
 *
 * This only applies once a literal text name (e.g. `li`) has been established:
 * - Standalone/inline tags (`echo`, `cycle`, `render`, `assign`, ...) output
 *   into the name the same way a `{{ drop }}` does, so they continue the name.
 *   They have no body, so the whitespace heuristic must not be applied to them
 *   (it would read unrelated following content as the body).
 * - Block tags (`if`, `unless`, `for`, `case`, ...) wrap content: a body that
 *   begins with whitespace opens the attribute list (`<li{% if x %} data-foo{% endif %}>`),
 *   while a content-led body continues the name (`<component-{% if x %}{{ x }}{% endif %}>`).
 *   The space is what delimits a tag name from its attributes.
 */
function liquidTagStartsAttributeList(
  parser: HtmlParserDelegate,
  segments: CompoundNameSegment[],
): boolean {
  if (!segments.some((s) => s.type === NodeTypes.TextNode)) return false;
  const tagName = parser.peekTagName();
  if (tagName === null || !BLOCKS.includes(tagName)) return false;
  return liquidTagBodyStartsWithWhitespace(parser);
}

/**
 * Peek whether the rendered body of the block tag at the current position
 * begins with whitespace. Markup *inside* `{% ... %}` (the control structure
 * itself, e.g. `if x`, `case y`, `when 'a'`) is skipped; only body content
 * emitted between tags is considered, so `{% case x %}{% when 'a' %} data-foo{% endcase %}`
 * is correctly read as whitespace-led. A trimming close delimiter (`-%}`) strips
 * the body's leading whitespace, so `{% if c -%} y{% endif %}` is content-led.
 */
/** A `{{-` or `{%-` open delimiter (length 3) left-trims preceding whitespace. */
function isLeftTrimmingOpen(
  tok: { type: TokenType; start: number; end: number } | undefined,
): boolean {
  return (
    tok !== undefined &&
    (tok.type === TokenType.LiquidVariableOutputOpen || tok.type === TokenType.LiquidTagOpen) &&
    tok.end - tok.start === 3
  );
}

function liquidTagBodyStartsWithWhitespace(parser: HtmlParserDelegate): boolean {
  const source = parser.getSource();
  const count = parser.tokenCount();
  let inTag = false;
  let trimNext = false;
  for (let i = parser.getPosition(); i < count; i++) {
    const tok = parser.tokenAt(i);
    switch (tok.type) {
      case TokenType.LiquidTagOpen:
        inTag = true;
        break;
      case TokenType.LiquidTagClose:
        inTag = false;
        trimNext = tok.end - tok.start === 3; // `-%}` trims following whitespace
        break;
      case TokenType.Text:
        if (!inTag) {
          let text = source.slice(tok.start, tok.end);
          if (trimNext) text = text.replace(/^\s+/, ''); // `-%}` strips leading whitespace
          trimNext = false;
          if (text.length === 0) break; // whitespace fully trimmed; keep scanning
          // A whitespace-only run immediately before a left-trimming `{{-`/`{%-`
          // is stripped from the rendered body, so it is not whitespace-led.
          if (/^\s+$/.test(text) && isLeftTrimmingOpen(parser.tokenAt(i + 1))) break;
          return /^\s/.test(text);
        }
        break;
      case TokenType.LiquidVariableOutputOpen:
        // Body begins with a `{{ }}` drop -> name continuation, not attributes.
        if (!inTag) return false;
        break;
      case TokenType.HtmlTagClose:
      case TokenType.HtmlSelfClose:
      case TokenType.EndOfInput:
        if (!inTag) return false;
        break;
    }
  }
  return false;
}

export function extractPlainName(name: CompoundNameSegment[]): string | null {
  if (name.length === 1 && name[0].type === NodeTypes.TextNode) {
    return name[0].value;
  }
  return null;
}

export function peekHtmlCloseTagMatches(
  parser: HtmlParserDelegate,
  openName: CompoundNameSegment[],
): boolean {
  if (!parser.check(TokenType.HtmlCloseTagOpen)) return false;
  const saved = parser.getPosition();
  parser.advance(); // skip HtmlCloseTagOpen
  const closeName = parseCompoundName(parser);
  parser.setPosition(saved);
  return compoundNamesMatch(openName, closeName);
}

export function scanForHtmlCloseTag(parser: ParserBase, tagName: string): number {
  const lowerName = tagName.toLowerCase();
  const source = parser.getSource();
  const tokenCount = parser.tokenCount();
  const pos = parser.getPosition();

  // Depth-balance nested same-name elements so the OUTER close tag is
  // returned, not the first inner one (e.g. `<svg>…<svg>…</svg>…</svg>`). A
  // nested open tag is an `HtmlTagOpen` followed by a `Text` token whose first
  // word matches the tag name — the tokenizer folds the tag name and any
  // trailing attributes into a single text token, so we take the first word.
  // The scan begins after the outer open tag has been consumed, so the outer
  // open is never counted. Mirrors `scanForEndTagNested`.
  let depth = 0;
  for (let i = pos; i < tokenCount; i++) {
    const token = parser.tokenAt(i);

    if (token.type === TokenType.HtmlTagOpen) {
      const textIdx = i + 1;
      if (textIdx >= tokenCount) continue;
      if (parser.tokenAt(textIdx).type !== TokenType.Text) continue;
      const trimmed = source
        .slice(parser.tokenAt(textIdx).start, parser.tokenAt(textIdx).end)
        .trimStart();
      const firstWs = trimmed.search(/\s/);
      const name = firstWs === -1 ? trimmed.trim() : trimmed.slice(0, firstWs);
      if (name.toLowerCase() === lowerName) depth++;
      continue;
    }

    if (token.type !== TokenType.HtmlCloseTagOpen) continue;
    const textIdx = i + 1;
    if (textIdx >= tokenCount) continue;
    if (parser.tokenAt(textIdx).type !== TokenType.Text) continue;
    const text = source.slice(parser.tokenAt(textIdx).start, parser.tokenAt(textIdx).end);
    if (text.trim().toLowerCase() === lowerName) {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

export function rawMarkupKindForHtmlTag(
  tagName: string,
  attributes: AttributeNode[] = [],
  bodySource: string = '',
): RawMarkupKinds {
  switch (tagName.toLowerCase()) {
    case 'script':
      return scriptKindFromAttributes(attributes);
    case 'style':
      return /\{[{%]/.test(bodySource) ? RawMarkupKinds.text : RawMarkupKinds.css;
    default:
      return RawMarkupKinds.text;
  }
}

function scriptKindFromAttributes(attributes: AttributeNode[]): RawMarkupKinds {
  const typeValue = extractPlainAttributeValue(attributes, 'type');
  if (typeValue === null) return RawMarkupKinds.javascript;
  if (typeValue === 'text/html') return RawMarkupKinds.html;
  if (typeValue === 'text/markdown') return RawMarkupKinds.markdown;
  if (
    typeValue.endsWith('json') ||
    typeValue.endsWith('importmap') ||
    typeValue === 'speculationrules'
  ) {
    return RawMarkupKinds.json;
  }
  return RawMarkupKinds.javascript;
}

function extractPlainAttributeValue(
  attributes: AttributeNode[],
  targetName: string,
): string | null {
  for (const attr of attributes) {
    if (!('name' in attr) || !('value' in attr)) continue;
    const attrNode = attr as AttrDoubleQuoted | AttrSingleQuoted | AttrUnquoted;
    const name = extractPlainName(attrNode.name);
    if (name === null || name.toLowerCase() !== targetName) continue;
    const values = attrNode.value;
    if (values.length === 1 && values[0].type === NodeTypes.TextNode) {
      return (values[0] as TextNode).value;
    }
    return null;
  }
  return null;
}

const BRANCH_KEYWORDS = new Set(['else', 'elsif', 'when']);
