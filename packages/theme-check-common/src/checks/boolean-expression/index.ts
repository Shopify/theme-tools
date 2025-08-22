import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';

export const BooleanExpression: LiquidCheckDefinition = {
  meta: {
    code: 'BooleanExpression',
    name: 'Boolean expressions with lax parsing issues',
    docs: {
      description:
        'Detects boolean expressions that behave differently due to Liquid\'s lax parsing mode and suggests fixes.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    // Token types for simplified parsing
    type Token = {
      type: 'identifier' | 'number' | 'string' | 'literal' | 'operator' | 'logical' | 'unknown';
      value: string;
      start: number;
      end: number;
    };

    const LOGICAL_OPS = ['and', 'or'];
    const COMPARISON_OPS = ['==', '!=', '>=', '<=', '>', '<', 'contains'];
    const LITERALS = ['true', 'false', 'nil', 'null', 'blank', 'empty'];

    function tokenize(markup: string): Token[] {
      const tokens: Token[] = [];
      let i = 0;

      while (i < markup.length) {
        // Skip whitespace
        if (/\s/.test(markup[i]!)) {
          i++;
          continue;
        }

        const start = i;

        // String literals
        if (markup[i] === '"' || markup[i] === "'") {
          const quote = markup[i]!;
          i++; // Skip opening quote
          while (i < markup.length && markup[i] !== quote) {
            if (markup[i] === '\\') i++; // Skip escaped char
            i++;
          }
          if (i < markup.length) i++; // Skip closing quote
          tokens.push({
            type: 'string',
            value: markup.slice(start, i),
            start,
            end: i
          });
          continue;
        }

        // Numbers
        const numMatch = /^[\d_]+(\.\d+)?/.exec(markup.slice(i));
        if (numMatch) {
          i += numMatch[0].length;
          tokens.push({
            type: 'number',
            value: numMatch[0],
            start,
            end: i
          });
          continue;
        }

        // Comparison operators (check longer ones first)
        const opMatch = COMPARISON_OPS.find(op => markup.startsWith(op, i));
        if (opMatch) {
          i += opMatch.length;
          tokens.push({
            type: 'operator',
            value: opMatch,
            start,
            end: i
          });
          continue;
        }

        // Words (identifiers, literals, logical operators)
        const wordMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(markup.slice(i));
        if (wordMatch) {
          const word = wordMatch[0];
          i += word.length;

          let type: Token['type'];
          if (LOGICAL_OPS.includes(word)) {
            type = 'logical';
          } else if (LITERALS.includes(word)) {
            type = 'literal';
          } else {
            type = 'identifier';
          }

          tokens.push({
            type,
            value: word,
            start,
            end: i
          });
          continue;
        }

        // Unknown token
        const unknownChar = markup[i]!;
        i++;
        tokens.push({
          type: 'unknown',
          value: unknownChar,
          start,
          end: i
        });
      }

      return tokens;
    }

    function simulateLiquidParsing(tokens: Token[]): {
      actualExpression: string,
      issues: Array<{
        message: string,
        suggestion: string,
        wouldError: boolean
      }>
    } {
      const issues: Array<{message: string, suggestion: string, wouldError: boolean}> = [];
      const result: string[] = [];
      let i = 0;

      function isTruthy(token: Token): boolean {
        // In Liquid: numbers and strings are truthy, only 'false' and 'nil' are falsy
        if (token.type === 'number' || token.type === 'string') return true;
        if (token.type === 'literal') return !['false', 'nil', 'null'].includes(token.value);
        if (token.type === 'identifier') return false; // Depends on runtime value, assume falsy for analysis
        return false;
      }

            function parseCondition(): boolean {
        if (i >= tokens.length) return false;

        const leftToken = tokens[i]!;
        result.push(leftToken.value);
        i++;

        // Look for comparison operator first (both symbol and word operators like 'contains')
        if (i < tokens.length && (tokens[i]!.type === 'operator' ||
                                 (tokens[i]!.type === 'identifier' && tokens[i]!.value === 'contains'))) {
          const op = tokens[i]!;
          result.push(op.value);
          i++;

          // Get right operand
          if (i < tokens.length && (tokens[i]!.type === 'identifier' || tokens[i]!.type === 'number' ||
                                   tokens[i]!.type === 'string' || tokens[i]!.type === 'literal')) {
            const rightToken = tokens[i]!;
            result.push(rightToken.value);
            i++;

            // Check for trailing junk after complete comparison
            const trailingTokens: string[] = [];
            while (i < tokens.length && tokens[i]!.type !== 'logical') {
              trailingTokens.push(tokens[i]!.value);
              i++;
            }

            if (trailingTokens.length > 0) {
              issues.push({
                message: `Trailing tokens ignored after comparison: '${trailingTokens.join(' ')}'`,
                suggestion: `${leftToken.value} ${op.value} ${rightToken.value}`,
                wouldError: false
              });
            }
            return true;
          }
        }

        // Check for unknown operator pattern (identifier followed by non-operator identifier)
        if (leftToken.type === 'identifier' && i < tokens.length) {
          const nextToken = tokens[i]!;
          if (nextToken.type === 'identifier' && !LOGICAL_OPS.includes(nextToken.value)) {
            issues.push({
              message: `Unknown operator '${nextToken.value}' after variable '${leftToken.value}'`,
              suggestion: leftToken.value,
              wouldError: true
            });
            return true;
          }
        }

        // If left side is a truthy literal/number/string and no operator found, check for "left-side evaluation"
        if (isTruthy(leftToken) && leftToken.type !== 'identifier') {
          // Look for tokens after this that would be ignored
          const nextTokens = tokens.slice(i).filter(t => t.type !== 'logical');
          if (nextTokens.length > 0) {
            const ignoredTokens = nextTokens.map(t => t.value).join(' ');
            issues.push({
              message: `Expression stops at truthy value '${leftToken.value}', ignoring: '${ignoredTokens}'`,
              suggestion: leftToken.value,
              wouldError: false
            });
            // Skip to next logical operator or end
            while (i < tokens.length && tokens[i]!.type !== 'logical') {
              i++;
            }
            return true;
          }
        }

        return true;
      }

      // Parse first condition
      if (!parseCondition()) {
        return { actualExpression: '', issues };
      }

      // Handle logical operators
      while (i < tokens.length && tokens[i]!.type === 'logical') {
        const logicalOp = tokens[i]!;
        result.push(logicalOp.value);
        i++;

        if (!parseCondition()) {
          break;
        }
      }

      return {
        actualExpression: result.join(' '),
        issues
      };
    }

    return {
      async LiquidTag(node) {
        if (!('name' in node) || !node.name) return;
        if (!['if', 'elsif', 'unless'].includes(String(node.name))) return;

        const markup: any = (node as any).markup;
        if (typeof markup !== 'string') return;

        const tokens = tokenize(markup);
        if (tokens.length === 0) return;

        const analysis = simulateLiquidParsing(tokens);

        // Only report if there are actual issues
        if (analysis.issues.length === 0) return;

        const openingTagRange = (node as any).blockStartPosition;
        const openingTag = (node as any).source.slice(openingTagRange.start, openingTagRange.end);
        const markupOffsetInOpening = openingTag.indexOf(markup);
        if (markupOffsetInOpening < 0) return;

        const startIndex = openingTagRange.start + markupOffsetInOpening;
        const endIndex = startIndex + markup.length;

        // Report the most significant issue
        const primaryIssue = analysis.issues.find(i => i.wouldError) || analysis.issues[0]!;

        context.report({
          message: `Lax parsing issue: ${primaryIssue.message}`,
          startIndex,
          endIndex,
          fix: (corrector) => {
            corrector.replace(startIndex, endIndex, primaryIssue.suggestion);
          },
        });
      },
    };
  },
};

export default BooleanExpression;


