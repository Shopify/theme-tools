import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';

export const BooleanExpression: LiquidCheckDefinition = {
  meta: {
    code: 'BooleanExpression',
    name: 'Validate boolean expressions in Liquid tags',
    docs: {
      description:
        'Removes tokens in conditional tags that Liquid ignores due to its lax parsing.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    function isWhitespace(char: string) {
      return /\s/.test(char);
    }

    function readWhile(src: string, i: number, pred: (c: string) => boolean) {
      let j = i;
      while (j < src.length && pred(src[j]!)) j++;
      return j;
    }

    function skipSpaces(src: string, i: number) {
      return readWhile(src, i, isWhitespace);
    }

    function readString(src: string, i: number) {
      const quote = src[i]!;
      if (quote !== "'" && quote !== '"') return null as null | { end: number; text: string };
      let j = i + 1;
      while (j < src.length) {
        const ch = src[j]!;
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === quote) {
          return { end: j + 1, text: src.slice(i, j + 1) };
        }
        j++;
      }
      return { end: src.length, text: src.slice(i) };
    }

    function readNumber(src: string, i: number) {
      const m = /^(?:\d[\d_]*)(?:\.\d+)?/.exec(src.slice(i));
      if (!m) return null as null | { end: number; text: string };
      return { end: i + m[0].length, text: m[0] };
    }

    function readIdentifier(src: string, i: number) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (!m) return null as null | { end: number; text: string };
      return { end: i + m[0].length, text: m[0] };
    }

    function readSymbolComparator(src: string, i: number) {
      const symbols = ['==', '!=', '>=', '<=', '>', '<'];
      for (const sym of symbols) {
        if (src.startsWith(sym, i)) return { end: i + sym.length, text: sym };
      }
      return null as null | { end: number; text: string };
    }

    function readWord(src: string, i: number, word: string) {
      if (src.startsWith(word, i)) {
        const ahead = i + word.length;
        const beforeOk = i === 0 || /\W/.test(src[i - 1]!);
        const afterOk = ahead >= src.length || /\W/.test(src[ahead]!);
        if (beforeOk && afterOk) return { end: ahead, text: word } as const;
      }
      return null;
    }

    const literalKeywords = new Set(['true', 'false', 'nil', 'null', 'blank', 'empty']);

    function parseExpression(src: string, i: number):
      | null
      | { end: number; text: string; kind: 'id' | 'num' | 'str' | 'lit' } {
      i = skipSpaces(src, i);
      if (i >= src.length) return null;
      const str = readString(src, i);
      if (str) return { ...str, kind: 'str' };
      const num = readNumber(src, i);
      if (num) return { ...num, kind: 'num' };
      const id = readIdentifier(src, i);
      if (id) return { ...id, kind: literalKeywords.has(id.text) ? 'lit' : 'id' };
      return null;
    }

    function cleanConditionalMarkup(original: string): string | null {
      // Build a cleaned conditional by mimicking Liquid's lax parsing behavior.
      let i = 0;
      let out = '';
      let aborted = false;

      function appendToken(txt: string) {
        if (out.length > 0 && !/\s$/.test(out)) out += ' ';
        out += txt;
      }

      function parseSingleCondition() {
        // left expression
        const left = parseExpression(original, i);
        if (!left) return false;
        appendToken(original.slice(i, left.end).trim());
        i = left.end;

        // try to find comparator; skip stray identifier words (treated as unknown operators)
        while (true) {
          const before = i;
          i = skipSpaces(original, i);
          // comparator by symbol
          const sym = readSymbolComparator(original, i);
          if (sym) {
            appendToken(sym.text);
            i = sym.end;
            const right = parseExpression(original, i);
            if (!right) return true;
            appendToken(original.slice(i, right.end).trim());
            i = right.end;
            return true;
          }
          // comparator by word 'contains'
          const contains = readWord(original, i, 'contains');
          if (contains) {
            appendToken(contains.text);
            i = contains.end;
            const right = parseExpression(original, i);
            if (!right) return true;
            appendToken(original.slice(i, right.end).trim());
            i = right.end;
            return true;
          }
          // if next token is an identifier that is not logic operator, skip it (unknown operator noise)
          const maybeId = readIdentifier(original, i);
          const andOp = readWord(original, i, 'and');
          const orOp = readWord(original, i, 'or');
          if (andOp || orOp) {
            // no comparator, end condition here; logic handled by caller
            i = (andOp ?? orOp)!.end;
            // push back to let caller see logic token
            i -= (andOp ?? orOp)!.text.length;
            return true;
          }
          if (maybeId) {
            // If the left term was an identifier, an immediate identifier is an unknown operator -> abort
            if (left.kind === 'id') {
              aborted = true;
              return true;
            }
            // Otherwise, the condition is already complete (e.g., numbers/strings/literals)
            // Stop here and let outer logic handle chaining or end of condition.
            return true;
          }
          // if we see a number or string here, Liquid would stop (left truthiness only)
          const maybeNum = readNumber(original, i) || readString(original, i);
          if (maybeNum) {
            return true;
          }
          // nothing useful; stop
          if (before === i) return true;
        }
      }

      // first condition
      if (!parseSingleCondition()) return null;

      // chain logic operators
      while (true) {
        const before = i;
        i = skipSpaces(original, i);
        const andOp = readWord(original, i, 'and');
        const orOp = readWord(original, i, 'or');
        const logic = andOp ?? orOp;
        if (!logic) break;
        appendToken(logic.text);
        i = logic.end;
        const ok = parseSingleCondition();
        if (!ok) break;
      }

      if (aborted) return null;
      return out.trim();
    }

    return {
      async LiquidTag(node) {
        if (!('name' in node) || !node.name) return;
        if (!['if', 'elsif', 'unless'].includes(String(node.name))) return;

        // Skip on valid expressions
        const markup: any = (node as any).markup;
        if (typeof markup !== 'string') return;

        const cleaned = cleanConditionalMarkup(markup);
        if (!cleaned || cleaned === markup.trim()) return;

        // Safety: avoid auto-fixing patterns like "id id > expr" which would error at runtime
        if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s+[A-Za-z_][A-Za-z0-9_]*/.test(markup) &&
            !/^\s*[A-Za-z_][A-Za-z0-9_]*\s+(and|or|contains)\b/.test(markup)) {
          return;
        }

        const openingTagRange = (node as any).blockStartPosition;
        const openingTag = (node as any).source.slice(openingTagRange.start, openingTagRange.end);
        const markupOffsetInOpening = openingTag.indexOf(markup);
        if (markupOffsetInOpening < 0) return;

        const startIndex = openingTagRange.start + markupOffsetInOpening;
        const endIndex = startIndex + markup.length;

        context.report({
          message: 'Remove ignored tokens in boolean expression',
          startIndex,
          endIndex,
          fix: (corrector) => {
            corrector.replace(startIndex, endIndex, cleaned);
          },
        });
      },
    };
  },
};

export default BooleanExpression;


