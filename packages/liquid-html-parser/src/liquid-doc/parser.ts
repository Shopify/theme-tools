/**
 * Recursive-descent parser for LiquidDoc body content.
 *
 * Consumes level-1 tokens (Annotation, TextLine, Newline) from the body
 * tokenizer. For @param, re-tokenizes the inline content using the level-2
 * param tokenizer to extract {type}, [name], -, and description.
 *
 * No raw string scanning in this file — all extraction is token-based.
 */

import { LiquidDocTokenType, ParamTokenType } from './tokenizer';
import type { LiquidDocToken, ParamToken } from './tokenizer';
import { tokenizeLiquidDoc, tokenizeParamContent } from './tokenizer';
import {
  makeTextNode,
  makeLiquidDocParamNode,
  makeLiquidDocDescriptionNode,
  makeLiquidDocExampleNode,
  makeLiquidDocPromptNode,
} from './factories';
import type {
  TextNode,
  LiquidDocParamNode,
  LiquidDocDescriptionNode,
  LiquidDocExampleNode,
  LiquidDocPromptNode,
} from '../ast';
import { assertNever } from '../utils';

/** Union of all nodes that can appear in a LiquidDoc body. */
export type LiquidDocNode =
  | LiquidDocParamNode
  | LiquidDocDescriptionNode
  | LiquidDocExampleNode
  | LiquidDocPromptNode
  | TextNode;

/**
 * Parse a LiquidDoc body string into AST nodes.
 */
export function parseLiquidDoc(body: string, startOffset: number, source: string): LiquidDocNode[] {
  const tokens = tokenizeLiquidDoc(body, startOffset);
  const parser = new LiquidDocParser(tokens, source);
  return parser.parse();
}

export class LiquidDocParser {
  private tokens: LiquidDocToken[];
  private source: string;
  private p: number;

  constructor(tokens: LiquidDocToken[], source: string) {
    this.tokens = tokens;
    this.source = source;
    this.p = 0;
  }

  /**
   * Parse the full LiquidDoc body into a list of nodes.
   */
  // liquidDoc := implicitDescription? annotation*
  parse(): LiquidDocNode[] {
    const nodes: LiquidDocNode[] = [];

    this.skipBlankLines();

    // Implicit description: text before any @annotation
    if (this.check(LiquidDocTokenType.TextLine)) {
      nodes.push(this.parseImplicitDescription());
    }

    this.skipBlankLines();

    while (!this.isAtEnd()) {
      if (this.check(LiquidDocTokenType.Newline)) {
        this.skipNewlines();
        continue;
      }

      if (this.check(LiquidDocTokenType.Annotation)) {
        nodes.push(this.parseAnnotation());
        continue;
      }

      // Skip whitespace-only text lines in the main loop
      if (this.check(LiquidDocTokenType.TextLine) && this.peek().value.trim() === '') {
        this.advance();
        continue;
      }

      // Unexpected text — collect consecutive text lines into a single TextNode
      if (this.check(LiquidDocTokenType.TextLine)) {
        const { value, startPos, endPos } = this.collectContentLines({
          trimTrailingNewlines: true,
        });
        if (value.trim().length > 0) {
          nodes.push(makeTextNode(value, startPos, endPos, this.source));
        }
        continue;
      }

      // Any other unexpected token — consume as single text fallback
      const tok = this.advance();
      nodes.push(makeTextNode(tok.value, tok.start, tok.end, this.source));
    }

    return nodes;
  }

  // implicitDescription := textLine+
  private parseImplicitDescription(): LiquidDocDescriptionNode {
    const { value, startPos, endPos } = this.collectContentLines();
    const content = makeTextNode(value, startPos, endPos, this.source);
    return makeLiquidDocDescriptionNode(content, true, true, startPos, endPos, this.source);
  }

  // annotation := "@" annotationName content
  private parseAnnotation(): LiquidDocNode {
    const annotationToken = this.consume(LiquidDocTokenType.Annotation);
    const name = annotationToken.value;

    // `@descriptionText` — no space between `@description` and its content. The
    // level-1 tokenizer greedily folds the leading text into the annotation
    // name (`descriptionText`), so recognize the `description` prefix here and
    // treat the glued remainder as the start of the inline description content.
    // This matches the pre-swap parser, which printed `@description Text`.
    if (
      name !== LiquidDocAnnotation.Description &&
      name.startsWith(LiquidDocAnnotation.Description)
    ) {
      return this.parseGluedDescription(annotationToken);
    }

    if (!isKnownAnnotation(name)) {
      return this.parseUnsupportedAnnotation(annotationToken);
    }

    switch (name) {
      case LiquidDocAnnotation.Param:
        return this.parseParam(annotationToken);
      case LiquidDocAnnotation.Description:
        return this.parseDescription(annotationToken);
      case LiquidDocAnnotation.Example:
        return this.parseExample(annotationToken);
      case LiquidDocAnnotation.Prompt:
        return this.parsePrompt(annotationToken);
      default:
        assertNever(name);
    }
  }

  /**
   * Parse @param using the level-2 param tokenizer.
   *
   * The first TextLine after `@param` is re-tokenized into {type}, [name], -, word, text.
   * Subsequent lines (collected via collectContentLines) are appended to the description.
   */
  // param := "@param" ("{" type "}")? ("[" name "]" | name) ("-" description)?
  private parseParam(annotationToken: LiquidDocToken): LiquidDocParamNode {
    const start = annotationToken.start;

    // Get the inline content on the same line as @param
    const inlineToken = this.accept(LiquidDocTokenType.TextLine);
    if (!inlineToken) {
      // @param with nothing after it
      const emptyName = makeTextNode('', annotationToken.end, annotationToken.end, this.source);
      return makeLiquidDocParamNode(
        emptyName,
        null,
        null,
        true,
        start,
        annotationToken.end,
        this.source,
      );
    }

    // Re-tokenize the inline content for param-specific grammar
    const walker = new ParamTokenWalker(tokenizeParamContent(inlineToken.value, inlineToken.start));

    // Optional type: {type}
    let paramType: TextNode | null = null;
    const typeToken = walker.accept(ParamTokenType.Type);
    if (typeToken) {
      paramType = makeTextNode(
        typeToken.value,
        typeToken.start + 1,
        typeToken.end - 1,
        this.source,
      );
    }

    // Name: [name] (optional) or Word (required)
    let paramName: TextNode;
    let required: boolean;

    const optNameToken = walker.accept(ParamTokenType.OptionalName);
    if (optNameToken) {
      required = false;
      paramName = makeTextNode(
        optNameToken.value,
        optNameToken.start + 1,
        optNameToken.end - 1,
        this.source,
      );
    } else {
      required = true;
      const wordToken = walker.accept(ParamTokenType.Word);
      if (wordToken) {
        paramName = makeTextNode(wordToken.value, wordToken.start, wordToken.end, this.source);
      } else {
        paramName = makeTextNode('', annotationToken.end, annotationToken.end, this.source);
      }
    }

    // Optional dash + description
    let paramDescription: TextNode | null = null;
    const dashToken = walker.accept(ParamTokenType.Dash);

    // Collect remaining param tokens as inline description (source-slice to preserve whitespace)
    let inlineDescStart = -1;
    let inlineDescEnd = -1;
    while (!walker.isAtEnd()) {
      const t = walker.advance();
      if (inlineDescStart === -1) inlineDescStart = t.start;
      inlineDescEnd = t.end;
    }
    const inlineDesc =
      inlineDescStart !== -1 ? this.source.slice(inlineDescStart, inlineDescEnd) : '';

    // Collect multiline continuation (stop at paragraph breaks for @param, trim trailing newlines)
    const {
      value: continuation,
      startPos: _contStart,
      endPos: contEnd,
    } = this.collectContentLines({ stopAtParagraphBreak: true, trimTrailingNewlines: true });
    const hasContinuation = continuation.trim().length > 0;

    if (inlineDesc || hasContinuation) {
      const fullDesc = hasContinuation ? inlineDesc + continuation : inlineDesc;
      const descStart =
        inlineDescStart !== -1
          ? inlineDescStart
          : dashToken
            ? dashToken.end + 1
            : annotationToken.end;
      const descEnd = hasContinuation ? contEnd : inlineDescEnd;
      paramDescription = makeTextNode(fullDesc, descStart, descEnd, this.source);
    }

    const end = paramDescription?.position.end ?? inlineToken.end;
    return makeLiquidDocParamNode(
      paramName,
      paramType,
      paramDescription,
      required,
      start,
      end,
      this.source,
    );
  }

  // description := "@description" content
  private parseDescription(annotationToken: LiquidDocToken): LiquidDocDescriptionNode {
    const start = annotationToken.start;
    const inlineToken = this.accept(LiquidDocTokenType.TextLine);
    const isInline = inlineToken !== null;

    if (isInline) {
      const { value: rest, endPos } = this.collectContentLines();
      const hasCont = rest.trim().length > 0;
      const fullContent = hasCont ? inlineToken!.value + rest : inlineToken!.value;
      const end = hasCont ? endPos : inlineToken!.end;
      const content = makeTextNode(fullContent, inlineToken!.start, end, this.source);
      return makeLiquidDocDescriptionNode(content, false, true, start, end, this.source);
    }

    this.skipBlankLines();
    const { value, startPos, endPos } = this.collectContentLines();
    const contentStart = value ? startPos : annotationToken.end;
    const content = makeTextNode(
      value || '',
      contentStart,
      value ? endPos : contentStart,
      this.source,
    );
    return makeLiquidDocDescriptionNode(
      content,
      false,
      false,
      start,
      value ? endPos : contentStart,
      this.source,
    );
  }

  // gluedDescription := "@description" gluedContent  (no separating space)
  //
  // The glued suffix and any same-line text that follows are one inline
  // description. Content is read straight from source (not by concatenating
  // token values) so the original spacing between the suffix and the trailing
  // text is preserved — the suffix's own token boundary is mid-word.
  private parseGluedDescription(annotationToken: LiquidDocToken): LiquidDocDescriptionNode {
    const start = annotationToken.start;
    // Source offset immediately past the literal `@description`; the glued
    // remainder (e.g. `This` in `@descriptionThis`) begins here.
    const contentStart = start + 1 + LiquidDocAnnotation.Description.length;

    const inlineToken = this.accept(LiquidDocTokenType.TextLine);
    const { value: rest, endPos } = this.collectContentLines();
    const hasRest = rest.trim().length > 0;

    let end: number;
    if (hasRest) end = endPos;
    else if (inlineToken) end = inlineToken.end;
    else end = annotationToken.end;

    const content = makeTextNode(
      this.source.slice(contentStart, end),
      contentStart,
      end,
      this.source,
    );
    return makeLiquidDocDescriptionNode(content, false, true, start, end, this.source);
  }

  // example := "@example" content
  private parseExample(annotationToken: LiquidDocToken): LiquidDocExampleNode {
    const start = annotationToken.start;
    const inlineToken = this.accept(LiquidDocTokenType.TextLine);
    const isInline = inlineToken !== null;

    if (isInline) {
      const { value: rest, endPos } = this.collectContentLines();
      const hasCont = rest.trim().length > 0;
      const fullContent = hasCont ? inlineToken!.value + rest : inlineToken!.value;
      const end = hasCont ? endPos : inlineToken!.end;
      const content = makeTextNode(fullContent, inlineToken!.start, end, this.source);
      return makeLiquidDocExampleNode(content, true, start, end, this.source);
    }

    // Non-inline: skip initial blank lines before the example content
    this.skipBlankLines();
    const { value, startPos, endPos } = this.collectContentLines();
    const contentStart = value ? startPos : annotationToken.end;
    const content = makeTextNode(
      value || '',
      contentStart,
      value ? endPos : contentStart,
      this.source,
    );
    return makeLiquidDocExampleNode(
      content,
      false,
      start,
      value ? endPos : contentStart,
      this.source,
    );
  }

  // prompt := "@prompt" content
  private parsePrompt(annotationToken: LiquidDocToken): LiquidDocPromptNode {
    const start = annotationToken.start;
    const { value, startPos, endPos } = this.collectContentLines();
    const contentStart = value ? startPos : annotationToken.end;
    const content = makeTextNode(
      value || '',
      contentStart,
      value ? endPos : contentStart,
      this.source,
    );
    return makeLiquidDocPromptNode(content, start, value ? endPos : contentStart, this.source);
  }

  // unsupportedAnnotation := "@" name content
  private parseUnsupportedAnnotation(annotationToken: LiquidDocToken): TextNode {
    const start = annotationToken.start;
    const inlineToken = this.accept(LiquidDocTokenType.TextLine);
    if (inlineToken) {
      const fullValue = this.source.slice(start, inlineToken.end);
      return makeTextNode(fullValue, start, inlineToken.end, this.source);
    }
    const fullValue = '@' + annotationToken.value;
    return makeTextNode(fullValue, start, annotationToken.end, this.source);
  }

  private peek(): LiquidDocToken {
    return this.tokens[this.p];
  }

  private consume(type: LiquidDocTokenType): LiquidDocToken {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but found ${token.type} (${JSON.stringify(token.value)})`);
    }
    this.advance();
    return token;
  }

  private accept(type: LiquidDocTokenType): LiquidDocToken | null {
    if (this.peek().type !== type) return null;
    return this.advance();
  }

  private check(type: LiquidDocTokenType): boolean {
    return this.tokens[this.p].type === type;
  }

  private isAtEnd(): boolean {
    return this.check(LiquidDocTokenType.EndOfInput);
  }

  /** Consume the current token unconditionally and advance. */
  private advance(): LiquidDocToken {
    return this.tokens[this.p++];
  }

  private skipNewlines(): boolean {
    let skipped = false;
    while (this.check(LiquidDocTokenType.Newline)) {
      this.advance();
      skipped = true;
    }
    return skipped;
  }

  /** Skip newlines and whitespace-only text lines (e.g. indentation with no content). */
  private skipBlankLines(): void {
    while (!this.isAtEnd()) {
      if (this.check(LiquidDocTokenType.Newline)) {
        this.advance();
        continue;
      }
      if (this.check(LiquidDocTokenType.TextLine) && this.peek().value.trim() === '') {
        this.advance();
        continue;
      }
      break;
    }
  }

  /**
   * Collect text lines and newlines until the next @annotation or end of input.
   * Returns the concatenated content and end position.
   *
   * Options:
   * - stopAtParagraphBreak: stop at blank line + non-annotation text (for @param)
   * - trimTrailingNewlines: strip trailing \n from value (for @param + free text)
   */
  private collectContentLines(
    opts: { stopAtParagraphBreak?: boolean; trimTrailingNewlines?: boolean } = {},
  ): { value: string; startPos: number; endPos: number } {
    const { stopAtParagraphBreak = false, trimTrailingNewlines = false } = opts;
    let value = '';
    let startPos = this.tokens[this.p]?.start ?? this.tokens[this.p - 1].end;
    let endPos = startPos;

    while (!this.isAtEnd()) {
      const current = this.peek();

      if (this.check(LiquidDocTokenType.Annotation)) break;

      if (this.check(LiquidDocTokenType.Newline)) {
        // Look ahead past newlines and whitespace-only text to see if we should stop
        let lookAhead = this.p + 1;
        while (lookAhead < this.tokens.length) {
          const la = this.tokens[lookAhead];
          if (la.type === LiquidDocTokenType.Newline) {
            lookAhead++;
            continue;
          }
          if (la.type === LiquidDocTokenType.TextLine && la.value.trim() === '') {
            lookAhead++;
            continue;
          }
          break;
        }

        // Paragraph break: blank line(s) followed by non-annotation text.
        // Only applies to @param continuation — implicit descriptions span across blank lines.
        const newlineCount = lookAhead - this.p;
        if (
          stopAtParagraphBreak &&
          newlineCount >= 2 &&
          lookAhead < this.tokens.length &&
          this.tokens[lookAhead].type === LiquidDocTokenType.TextLine &&
          this.tokens[lookAhead].value.trim() !== ''
        ) {
          break;
        }

        // Trailing newlines before annotation boundary.
        if (
          lookAhead < this.tokens.length &&
          this.tokens[lookAhead].type === LiquidDocTokenType.Annotation
        ) {
          while (
            this.p < lookAhead &&
            (this.check(LiquidDocTokenType.Newline) ||
              (this.check(LiquidDocTokenType.TextLine) && this.peek().value.trim() === ''))
          ) {
            if (!trimTrailingNewlines) {
              if (this.check(LiquidDocTokenType.Newline)) value += '\n';
              endPos = this.peek().end;
            }
            this.advance();
          }
          break;
        }

        // Trailing newlines before end-of-input.
        if (
          lookAhead >= this.tokens.length ||
          this.tokens[lookAhead].type === LiquidDocTokenType.EndOfInput
        ) {
          while (
            !this.isAtEnd() &&
            (this.check(LiquidDocTokenType.Newline) ||
              (this.check(LiquidDocTokenType.TextLine) && this.peek().value.trim() === ''))
          ) {
            if (!trimTrailingNewlines) {
              if (this.check(LiquidDocTokenType.Newline)) value += '\n';
              endPos = this.peek().end;
            }
            this.advance();
          }
          break;
        }

        value += '\n';
        endPos = current.end;
        this.advance();
        continue;
      }

      // Skip whitespace-only text lines at the boundary (before end or annotation)
      if (this.check(LiquidDocTokenType.TextLine) && current.value.trim() === '') {
        this.advance();
        continue;
      }

      // TextLine — strip leading whitespace (indentation) on first line
      if (value === '') {
        const leadingWs = current.value.length - current.value.trimStart().length;
        startPos = current.start + leadingWs;
      }
      const trimmedLine = value === '' ? current.value.trimStart() : current.value;
      value += trimmedLine;
      endPos = current.end;
      this.advance();
    }

    return { value, startPos, endPos };
  }
}

/** Known annotation names that get dedicated node types. */
enum LiquidDocAnnotation {
  Param = 'param',
  Description = 'description',
  Example = 'example',
  Prompt = 'prompt',
}

function isKnownAnnotation(value: string): value is LiquidDocAnnotation {
  return (
    value === LiquidDocAnnotation.Param ||
    value === LiquidDocAnnotation.Description ||
    value === LiquidDocAnnotation.Example ||
    value === LiquidDocAnnotation.Prompt
  );
}

class ParamTokenWalker {
  private tokens: ParamToken[];
  private p: number = 0;

  constructor(tokens: ParamToken[]) {
    this.tokens = tokens;
  }

  accept(type: ParamTokenType): ParamToken | null {
    if (this.tokens[this.p].type !== type) return null;
    return this.tokens[this.p++];
  }

  check(type: ParamTokenType): boolean {
    return this.tokens[this.p].type === type;
  }

  isAtEnd(): boolean {
    return this.check(ParamTokenType.EndOfInput);
  }

  /** Current token (for reading value/position without consuming). */
  current(): ParamToken {
    return this.tokens[this.p];
  }

  /** Consume the current token unconditionally and advance. */
  advance(): ParamToken {
    return this.tokens[this.p++];
  }
}
