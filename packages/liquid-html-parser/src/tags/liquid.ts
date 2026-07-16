import type { MarkupParser } from '../markup/parser';
import {
  TagKind,
  type TagDefinitionTag,
  type Parser,
  type LiquidLine,
  type LiquidLineContext,
} from '../tag-definitions';
import type { LiquidStatement } from '../ast';

/**
 * Checks if a trimmed line is a continuation of the previous line rather
 * than a new statement. A line is a continuation when the previous line's
 * trimmed content ends with `,` and the current line looks like a named
 * argument (`identifier:`) rather than a new tag statement.
 */
function isContinuationLine(prevTrimmed: string, currentTrimmed: string): boolean {
  if (!prevTrimmed.endsWith(',')) return false;
  // A named-argument continuation: `word:` at the start (e.g. `bar: baz,`)
  return /^\w+\s*:/.test(currentTrimmed);
}

function parseLines(body: string, bodyStart: number): LiquidLine[] {
  const lines: LiquidLine[] = [];
  const rawLines = body.split('\n');

  // First pass: join continuation lines so multiline tags like
  //   render 'foo',
  //     bar: baz,
  //     qux: quux
  // become a single logical line.
  const joined: { raw: string; startIndex: number }[] = [];
  let offset = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const lineStart = bodyStart + offset;
    const trimmed = rawLine.trimStart();

    if (trimmed.length > 0 && joined.length > 0) {
      const prev = joined[joined.length - 1];
      const prevTrimmed = prev.raw.trimEnd();
      if (isContinuationLine(prevTrimmed, trimmed)) {
        // Append to previous logical line (preserve raw text for offset calc)
        prev.raw += '\n' + rawLine;
        offset += rawLine.length + 1;
        continue;
      }
    }

    joined.push({ raw: rawLine, startIndex: lineStart });
    offset += rawLine.length + 1;
  }

  // Second pass: parse each logical line into a LiquidLine.
  for (const { raw, startIndex } of joined) {
    const trimmed = raw.trimStart();
    const leadingWs = raw.length - trimmed.length;

    // For joined lines, the "trimmed" content may span multiple raw lines.
    // We only care about the first raw line's leading whitespace for the
    // name/markup offsets, and the last raw line's end for lineEnd.
    const lastNewline = raw.lastIndexOf('\n');
    const lastRawLine = lastNewline === -1 ? raw : raw.slice(lastNewline + 1);
    const lineEnd =
      lastNewline === -1
        ? startIndex + raw.trimEnd().length
        : startIndex + lastNewline + 1 + lastRawLine.trimEnd().length;

    if (trimmed.length > 0) {
      let tagName: string;
      let markup: string;
      let markupOffset: number;
      let nameOffset: number;

      // For tag name extraction, use only the first line's content.
      const firstNewline = trimmed.indexOf('\n');
      const firstLineTrimmed = firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline);

      if (firstLineTrimmed.startsWith('#')) {
        tagName = '#';
        // Strip at most one separator whitespace after `#`, mirroring the
        // pre-swap ohm grammar `"#" space?`. Trimming all leading whitespace
        // would collapse intentional indentation in `#`-comment art such as
        // `#     fancy`, which the printer re-pads with a single space.
        markup = trimmed.slice(1).replace(/^[ \t]/, '');
        nameOffset = startIndex + leadingWs;
        markupOffset = startIndex + leadingWs + 1 + (trimmed.length - 1 - markup.length);
      } else {
        const firstWs = firstLineTrimmed.search(/\s/);
        if (firstWs === -1) {
          tagName = firstLineTrimmed;
          markup = '';
          nameOffset = startIndex + leadingWs;
          markupOffset = startIndex + leadingWs + firstLineTrimmed.length;
        } else {
          tagName = firstLineTrimmed.slice(0, firstWs);
          const rest = trimmed.slice(firstWs);
          markup = rest.trimStart();
          nameOffset = startIndex + leadingWs;
          markupOffset = startIndex + leadingWs + firstWs + (rest.length - markup.length);
        }
      }

      lines.push({
        tagName,
        markup,
        markupOffset,
        nameOffset,
        lineEnd,
      });
    }
  }

  return lines;
}

export const liquidTag: TagDefinitionTag<LiquidStatement[]> = {
  kind: TagKind.Tag,
  parse(_name: string, markupParser: MarkupParser, parser: Parser): LiquidStatement[] {
    const { source, bodyStart, bodyEnd } = markupParser.bodyContext();
    const body = source.slice(bodyStart, bodyEnd);
    const lines = parseLines(body, bodyStart);
    const ctx: LiquidLineContext = { lines, index: 0 };
    const statements: LiquidStatement[] = [];

    while (ctx.index < ctx.lines.length) {
      const line = ctx.lines[ctx.index];
      ctx.index++;
      statements.push(
        parser.parseLiquidStatement(line.tagName, line.markup, line.markupOffset, ctx),
      );
    }

    return statements;
  },
};
