/**
 * Tokenizer for LiquidDoc body content.
 *
 * LiquidDoc is line-oriented: annotations start with `@name` at the beginning
 * of a (whitespace-trimmed) line. Content runs until the next annotation or
 * end-of-input.
 *
 * SPIKE CONSTRAINT DISCOVERED: We cannot tokenize `{type}`, `[name]`, and `-`
 * at the top level because those characters appear in content (e.g. `{{ x }}`
 * in @example blocks). These sub-tokens only make sense inside @param context.
 *
 * Solution: two-level tokenization.
 * - Level 1 (this file): splits into Annotation, TextLine, Newline, EndOfInput.
 * - Level 2 (tokenizeParamContent): splits a @param's text into Type, OptionalName, etc.
 */

export enum LiquidDocTokenType {
  /** `@param`, `@example`, `@description`, `@prompt`, etc. */
  Annotation = 'Annotation',
  /** A contiguous run of text on a single line (leading whitespace stripped). */
  TextLine = 'TextLine',
  /** A newline character (or \r\n). */
  Newline = 'Newline',
  /** End of input sentinel. */
  EndOfInput = 'EndOfInput',
}

export interface LiquidDocToken {
  type: LiquidDocTokenType;
  value: string;
  /** Absolute offset in the full source document. */
  start: number;
  /** Absolute offset, exclusive. */
  end: number;
}

/** Tokens for the @param sub-grammar. */
export enum ParamTokenType {
  /** `{type}` — a type annotation inside braces. */
  Type = 'Type',
  /** `[name]` — an optional param name in square brackets. */
  OptionalName = 'OptionalName',
  /** A bare word. */
  Word = 'Word',
  /** `-` dash separator. */
  Dash = 'Dash',
  /** Remaining text after name/dash. */
  Text = 'Text',
  /** End sentinel. */
  EndOfInput = 'EndOfInput',
}

export interface ParamToken {
  type: ParamTokenType;
  value: string;
  start: number;
  end: number;
}

/**
 * Tokenize the body of a LiquidDoc block (level 1).
 *
 * @param body - The raw text between `{% doc %}` and `{% enddoc %}`.
 * @param startOffset - The absolute offset of `body[0]` in the full source document.
 */
export function tokenizeLiquidDoc(body: string, startOffset: number): LiquidDocToken[] {
  const tokens: LiquidDocToken[] = [];
  let pos = 0;
  // Track whether the previous token on the current line was an Annotation.
  // Inline content after an annotation (e.g. `@param {type} name - desc @required`)
  // must NOT be split at mid-line `@word` patterns.
  let afterAnnotation = false;

  while (pos < body.length) {
    // Newline
    NEWLINE_RE.lastIndex = pos;
    if (NEWLINE_RE.test(body)) {
      const end = NEWLINE_RE.lastIndex;
      tokens.push({
        type: LiquidDocTokenType.Newline,
        value: body.slice(pos, end),
        start: pos + startOffset,
        end: end + startOffset,
      });
      pos = end;
      afterAnnotation = false;
      continue;
    }

    // Annotation: skip optional leading whitespace, then check for @name.
    // If found, consume both the whitespace and the annotation.
    // If not found, fall through to TextLine (preserving whitespace).
    WHITESPACE_RE.lastIndex = pos;
    const afterWs = WHITESPACE_RE.test(body) ? WHITESPACE_RE.lastIndex : pos;
    ANNOTATION_RE.lastIndex = afterWs;
    if (ANNOTATION_RE.test(body)) {
      const end = ANNOTATION_RE.lastIndex;
      tokens.push({
        type: LiquidDocTokenType.Annotation,
        value: body.slice(afterWs + 1, end), // strip the '@'
        start: afterWs + startOffset,
        end: end + startOffset,
      });
      pos = end;
      afterAnnotation = true;

      // Skip whitespace between annotation name and its inline content
      WHITESPACE_RE.lastIndex = pos;
      if (WHITESPACE_RE.test(body)) {
        pos = WHITESPACE_RE.lastIndex;
      }
      continue;
    }

    // TextLine: everything until end of line, preserving leading whitespace.
    // When NOT inline content after an annotation, split at mid-line `@word`
    // so the parser can treat it as an annotation boundary.
    const lineEnd = body.indexOf('\n', pos);
    const sliceEnd = lineEnd === -1 ? body.length : lineEnd;

    let effectiveEnd = sliceEnd;
    if (!afterAnnotation) {
      const lineText = body.slice(pos, sliceEnd);
      MIDLINE_ANNOTATION_RE.lastIndex = 0;
      const midMatch = MIDLINE_ANNOTATION_RE.exec(lineText);
      if (midMatch) {
        effectiveEnd = pos + midMatch.index + 1; // +1 because `.` consumes char before `@`
      }
    }

    const value = body.slice(pos, effectiveEnd);
    if (value.length > 0) {
      tokens.push({
        type: LiquidDocTokenType.TextLine,
        value,
        start: pos + startOffset,
        end: effectiveEnd + startOffset,
      });
    }
    pos = effectiveEnd;
    afterAnnotation = false;
  }

  tokens.push({
    type: LiquidDocTokenType.EndOfInput,
    value: '',
    start: body.length + startOffset,
    end: body.length + startOffset,
  });

  return tokens;
}

/**
 * Tokenize the inline content of a @param annotation (level 2).
 *
 * Input: the text that follows `@param ` on the same line, e.g. `{string} [title] - The title`.
 * Positions are absolute (document-relative).
 */
export function tokenizeParamContent(text: string, startOffset: number): ParamToken[] {
  const tokens: ParamToken[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Skip whitespace
    PARAM_WHITESPACE_RE.lastIndex = pos;
    if (PARAM_WHITESPACE_RE.test(text)) {
      pos = PARAM_WHITESPACE_RE.lastIndex;
      continue;
    }

    // Type: {type}
    TYPE_RE.lastIndex = pos;
    if (TYPE_RE.test(text)) {
      const end = TYPE_RE.lastIndex;
      tokens.push({
        type: ParamTokenType.Type,
        value: text.slice(pos + 1, end - 1),
        start: pos + startOffset,
        end: end + startOffset,
      });
      pos = end;
      continue;
    }

    // OptionalName: [name]
    OPTIONAL_NAME_RE.lastIndex = pos;
    if (OPTIONAL_NAME_RE.test(text)) {
      const end = OPTIONAL_NAME_RE.lastIndex;
      tokens.push({
        type: ParamTokenType.OptionalName,
        value: text.slice(pos + 1, end - 1),
        start: pos + startOffset,
        end: end + startOffset,
      });
      pos = end;
      continue;
    }

    // Dash: `-` followed by whitespace
    if (
      text[pos] === '-' &&
      (pos + 1 >= text.length || text[pos + 1] === ' ' || text[pos + 1] === '\t')
    ) {
      tokens.push({
        type: ParamTokenType.Dash,
        value: '-',
        start: pos + startOffset,
        end: pos + 1 + startOffset,
      });
      pos += 1;
      continue;
    }

    // Word
    WORD_RE.lastIndex = pos;
    if (WORD_RE.test(text)) {
      const end = WORD_RE.lastIndex;
      tokens.push({
        type: ParamTokenType.Word,
        value: text.slice(pos, end),
        start: pos + startOffset,
        end: end + startOffset,
      });
      pos = end;
      continue;
    }

    // Remaining text (everything else on the line)
    const remaining = text.slice(pos);
    tokens.push({
      type: ParamTokenType.Text,
      value: remaining,
      start: pos + startOffset,
      end: text.length + startOffset,
    });
    pos = text.length;
  }

  tokens.push({
    type: ParamTokenType.EndOfInput,
    value: '',
    start: text.length + startOffset,
    end: text.length + startOffset,
  });

  return tokens;
}

const ANNOTATION_RE = /@(\w+)/y;
const WHITESPACE_RE = /[ \t]+/y;
const NEWLINE_RE = /\r?\n/y;
/** Matches `@word` appearing after at least one character within a line (mid-line). */
const MIDLINE_ANNOTATION_RE = /.@\w+/g;
const TYPE_RE = /\{([^}]*)\}/y;
const OPTIONAL_NAME_RE = /\[([^\]]*)\]/y;
const WORD_RE = /[\w][\w-]*/y;
const PARAM_WHITESPACE_RE = /[ \t]+/y;
