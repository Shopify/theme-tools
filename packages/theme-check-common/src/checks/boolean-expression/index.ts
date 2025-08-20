import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';

// This is a lot of regex.
const IDENT = String.raw`[A-Za-z_][A-Za-z0-9_]*`;
const VARIABLE = String.raw`${IDENT}(?:\.(?:${IDENT})|\[[^\]]*\])*`;
const NUMBER = String.raw`\d+(?:\.\d+)?`;
const STRING = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'`;
const LITERAL = String.raw`(?:true|false|null|nil)`;
const PRIMARY = String.raw`(?:${NUMBER}|${STRING}|${LITERAL}|${VARIABLE})`;
const COMPARATOR = String.raw`(?:==|!=|>=|<=|>|<|\bcontains\b)`;
const COMPARISON = String.raw`${PRIMARY}\s*${COMPARATOR}\s*${PRIMARY}`;
const ATOMIC = String.raw`(?:${COMPARISON}|${PRIMARY})`;
const LOGICAL = String.raw`${ATOMIC}(?:\s+(?:and|or)\s+${ATOMIC})*`;

const ANYWHERE_EXPR_RE = new RegExp(`${LOGICAL}`, 'i');
const COMPLEX = String.raw`(?:${COMPARISON}|${ATOMIC}\s+(?:and|or)\s+${ATOMIC})(?:\s+(?:and|or)\s+${ATOMIC})*`;
const COMPLEX_EXPR_RE = new RegExp(`${COMPLEX}`, 'i');

export const BooleanExpression: LiquidCheckDefinition = {
  meta: {
    code: 'BooleanExpression',
    name: 'Validate boolean expressions in Liquid tags',
    docs: {
      description:
        'Flags trailing tokens after a boolean expression in conditional tags (if/elsif/unless) and offers a fix to remove them.',
      recommended: false,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidTag(node) {
        if (!('name' in node) || !node.name) return;
        if (!['if', 'elsif', 'unless'].includes(String(node.name))) return;

        // Skip on valid expressions
        const markup: any = (node as any).markup;
        if (typeof markup !== 'string') return;


        // Very fast pre-filter: if there are no obvious boolean operators, skip
        if (!(/[<>=]/.test(markup) || /\b(?:and|or|contains)\b/i.test(markup))) return;
        // Find the first complex expression (prefers operator presence), otherwise fallback to any expression
        const exprMatch = COMPLEX_EXPR_RE.exec(markup) || ANYWHERE_EXPR_RE.exec(markup);
        if (!exprMatch) return;

        const exprStartInMarkup = exprMatch.index;
        const exprEndInMarkup = exprStartInMarkup + exprMatch[0].length;

        // Compute left junk (before expression)
        const leftJunk = markup.slice(0, exprStartInMarkup);
        const hasLeftJunk = /\S/.test(leftJunk);

        // Compute trailing junk (after expression)
        const trailing = markup.slice(exprEndInMarkup);
        const ws = /^\s+/.exec(trailing)?.[0] ?? '';
        const tail = trailing.slice(ws.length);
        const hasRightJunk = tail.length > 0;

        if (!hasLeftJunk && !hasRightJunk) return; // nothing to do

        // Map to absolute source indices inside the opening tag
        const { blockStartPosition } = node as any;
        const tagStart = blockStartPosition.start as number;
        const tagEnd = blockStartPosition.end as number;
        const tagText = context.file.source.slice(tagStart, tagEnd);

        const markupOffsetInTag = tagText.indexOf(markup);
        if (markupOffsetInTag < 0) return; // safety: unexpected, bail out

        const markupAbsStart = tagStart + markupOffsetInTag;

        const leftAbsStart = markupAbsStart;
        const leftAbsEnd = markupAbsStart + exprStartInMarkup;

        const rightAbsStart = markupAbsStart + exprEndInMarkup + ws.length;
        const rightAbsEnd = markupAbsStart + markup.length;

        // Attempt normalization: keep first PRIMARY, first operator, then next PRIMARY
        const PRIMARY_RE = new RegExp(PRIMARY, 'i');
        const OP_RE = new RegExp(`(?:${COMPARATOR}|\\b(?:and|or)\\b)`, 'i');

        const firstM = PRIMARY_RE.exec(markup);
        let normalized: string | undefined;
        if (firstM) {
          const afterFirst = markup.slice(firstM.index + firstM[0].length);
          const opM = OP_RE.exec(afterFirst);
          if (opM) {
            const afterOp = afterFirst.slice(opM.index + opM[0].length);
            const secondM = PRIMARY_RE.exec(afterOp);
            if (secondM) {
              const first = firstM[0].trim();
              const op = opM[0].trim();
              const second = secondM[0].trim();
              normalized = `${first} ${op} ${second}`;
            }
          }
        }

        const message = normalized
          ? `Normalize boolean expression to "${normalized}"`
          : hasLeftJunk && hasRightJunk
          ? 'Remove extraneous tokens before and after the boolean expression.'
          : hasLeftJunk
          ? 'Remove extraneous tokens before the boolean expression.'
          : `Trailing tokens after the boolean expression are ignored by Liquid. Remove "${tail}"`;

        context.report({
          message,
          startIndex: normalized ? markupAbsStart : hasLeftJunk ? leftAbsStart : rightAbsStart,
          endIndex: normalized ? markupAbsStart + markup.length : hasRightJunk ? rightAbsEnd : leftAbsEnd,
          fix(corrector) {
            if (normalized) {
              corrector.replace(markupAbsStart, markupAbsStart + markup.length, normalized!);
              return;
            }
            if (hasRightJunk) corrector.remove(rightAbsStart, rightAbsEnd);
            if (hasLeftJunk) corrector.remove(leftAbsStart, leftAbsEnd);
          },
        });
      },
    };
  },
};

export default BooleanExpression;


