import {
  MarkupParser,
  NodeTypes,
  TokenType,
  tokenizeMarkup,
  tokenize,
  MarkupTokenType,
  type ComplexLiquidExpression,
  type LiquidArgument,
  type LiquidExpression,
  type LiquidRawTag,
  type LiquidTag,
  type LiquidVariable,
  type LiquidConditionalExpression,
  type MarkupToken,
  type Token,
} from './parser-compat';

/**
 * Resolves an error's location to a +[startIndex, endIndex]+ tuple.
 *
 * If the error carries a +loc+ property (with +start+ and +end+
 * sub-objects containing 1-indexed +line+/+column+ pairs), those
 * coordinates are converted to byte offsets via +getOffset+.
 * Otherwise the fallback +[0, source.length]+ is returned so that
 * the entire source is highlighted.
 */
export function resolveErrorLocation(error: Error, source: string): [number, number] {
  if ('loc' in error && error.loc) {
    const loc = error.loc as {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    return [
      getOffset(source, loc.start.line, loc.start.column),
      getOffset(source, loc.end.line, loc.end.column),
    ];
  }
  return [0, source.length];
}

/**
 * Converts a 1-indexed line and column back to a byte offset in +source+.
 *
 * The parser's +LiquidHTMLASTParsingError+ stores error locations as
 * 1-indexed +{line, column}+ pairs (via the +line-column+ library).
 * This helper reverses that conversion so we can report offsets in the
 * +startIndex+/+endIndex+ format that theme-check expects.
 */
export function getOffset(source: string, line: number, column: number): number {
  let currentLine = 1;
  for (let i = 0; i < source.length; i++) {
    if (currentLine === line) {
      return i + (column - 1);
    }
    if (source[i] === '\n') {
      currentLine++;
    }
  }
  return source.length;
}

/**
 * Returns +true+ when +expr+ is a bare bracket lookup.
 *
 * Ruby Liquid rejects a +VariableLookup+ whose name is +null+. Keep the
 * strict2 check AST-based so valid indexed lookups are not confused with
 * bare array access.
 *
 * Liquid examples:
 *
 *   +{% assign x = items[0] %}+   => false
 *   +{% assign x = [0] %}+        => true
 */
export function hasBareArrayAccess(expr: ComplexLiquidExpression): boolean {
  return expr.type === NodeTypes.VariableLookup && expr.name === null;
}

/**
 * Returns +true+ if +arg+ contains a bare bracket access.
 *
 * For named arguments (e.g. +size: [0]+), unwraps the
 * value first. For positional arguments, checks the
 * argument directly.
 *
 *   {{ x | filter: items[0] }}   => false
 *   {{ x | filter: [0] }}        => true
 */
export function argHasBareArrayAccess(arg: LiquidArgument): boolean {
  const expr = arg.type === NodeTypes.NamedArgument ? arg.value : arg;
  return hasBareArrayAccess(expr);
}

/**
 * Returns +true+ if a +LiquidVariable+ contains any bare
 * bracket access -- either in the main expression or in
 * any filter argument.
 *
 *   {{ items[0] | upcase }}      => false
 *   {{ [0] | upcase }}           => true
 *   {{ x | slice: [0] }}         => true
 */
export function variableHasBareArrayAccess(variable: LiquidVariable): boolean {
  return (
    hasBareArrayAccess(variable.expression) ||
    variable.filters.some((f) => f.args.some(argHasBareArrayAccess))
  );
}

/**
 * Returns +true+ if a +LiquidConditionalExpression+ tree
 * contains any bare bracket access.
 *
 * Walks the conditional tree recursively:
 * - +LogicalExpression+: recurse into +left+ and +right+
 * - +Comparison+: check +left+ and +right+ expressions
 * - Plain expression: delegate to +hasBareArrayAccess+
 *
 *   {% if [0] %}            => true
 *   {% if x == [0] %}       => true
 *   {% if x and [0] %}      => true
 *   {% if x == y %}         => false
 */
export function conditionalHasBareArrayAccess(expr: LiquidConditionalExpression): boolean {
  if (expr.type === NodeTypes.LogicalExpression) {
    return conditionalHasBareArrayAccess(expr.left) || conditionalHasBareArrayAccess(expr.right);
  }
  if (expr.type === NodeTypes.Comparison) {
    return hasBareArrayAccess(expr.left) || hasBareArrayAccess(expr.right);
  }
  return hasBareArrayAccess(expr);
}

export function hasBareContainsValueExpression(expr: ComplexLiquidExpression): boolean {
  if (expr.type === NodeTypes.VariableLookup) {
    return expr.name === 'contains';
  }

  if (expr.type === NodeTypes.Range) {
    return hasBareContainsValueExpression(expr.start) || hasBareContainsValueExpression(expr.end);
  }

  return false;
}

export function argHasBareContainsValueExpression(arg: LiquidArgument): boolean {
  const expr = arg.type === NodeTypes.NamedArgument ? arg.value : arg;
  return hasBareContainsValueExpression(expr);
}

export function variableHasBareContainsValueExpression(variable: LiquidVariable): boolean {
  return (
    hasBareContainsValueExpression(variable.expression) ||
    variable.filters.some((f) => f.args.some(argHasBareContainsValueExpression))
  );
}

export function expressionsHaveBareContainsValueExpression(
  expressions: LiquidExpression[],
): boolean {
  return expressions.some(hasBareContainsValueExpression);
}

/**
 * Returns the full raw markup slice for a Liquid tag.
 *
 * This uses +markupPosition+ rather than parsed markup node positions so
 * tokenizer-skipped bytes remain visible to syntax checks.
 */
export function rawMarkup(node: LiquidTag | LiquidRawTag): string {
  return node.source.slice(node.markupPosition.start, node.markupPosition.end);
}

/**
 * Returns +true+ when +markup+ has unclaimed non-whitespace bytes.
 *
 * Ruby Liquid does not accept garbage that the tokenizer skipped. Tokenize
 * the markup, mark every byte claimed by a token, then report any remaining
 * non-whitespace byte.
 *
 * Liquid examples:
 *
 *   +{% cycle foo, 'bar' %}+      => false  (fully covered)
 *   +{% cycle @foo, 'bar' %}+     => true   (+@+ is uncovered)
 *   +{% assign x = #val %}+       => true   (+#+ is uncovered)
 */
export function hasSkippedCharacters(markup: string): boolean {
  return uncoveredCharacters(markup).length > 0;
}

/**
 * Returns +true+ when +markup+ contains no parsed tokens and no garbage.
 *
 * Empty and whitespace-only markup are Ruby-accepted. Tokenize the markup
 * instead of trimming it so unclaimed bytes are still rejected.
 *
 * Liquid examples:
 *
 *   +{% echo %}+       => true
 *   +{{    }}+         => true
 *   +{{ @ }}+          => false
 */
export function hasEmptyMarkup(markup: string): boolean {
  return meaningfulTokens(markup).length === 0 && !hasSkippedCharacters(markup);
}

/**
 * Returns +true+ when +markup+ is exactly one identifier token.
 *
 * This uses tokenizer tokens and skipped-character coverage rather than
 * trimming or comparing normalized markup strings. Callers can use it for
 * raw-tag arguments that accept one specific identifier.
 *
 * Liquid examples:
 *
 *   +{% stylesheet scss %}+        => true for +scss+
 *   +{% stylesheet scss extra %}+  => false
 *   +{% stylesheet scss? %}+       => false
 */
export function hasSingleIdMarkup(markup: string, id: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);

  return tokens.length === 1 && tokens[0].type === MarkupTokenType.Id && tokens[0].value === id;
}

/**
 * Returns +true+ when inline comment +markup+ is Ruby-accepted.
 *
 * Ruby Liquid accepts any first line, then requires each nonblank
 * continuation line to start with an uncovered +#+ byte. A blank first
 * line with one nonblank continuation is accepted for parity.
 *
 * Liquid examples:
 *
 *   +{% # hello\n# world %}+  => true
 *   +{% # hello\nworld %}+    => false
 *   +{% #\nworld %}+          => true
 */
export function hasRubyValidInlineCommentMarkup(markup: string): boolean {
  const lines = inlineCommentLines(markup);
  let continuationLines = 0;
  let prefixedContinuationLines = 0;

  for (let i = 1; i < lines.length; i++) {
    const event = lines[i].firstEvent;
    if (!event) continue;

    continuationLines++;
    if (event.type === 'uncovered' && event.value === '#') {
      prefixedContinuationLines++;
    }
  }

  if (continuationLines === 0) return true;
  if (!lines[0].firstEvent && continuationLines === 1) return true;

  return continuationLines === prefixedContinuationLines;
}

/**
 * Returns +true+ for a Ruby-accepted trailing comma in +cycle+ markup.
 *
 * Ruby Liquid accepts a single terminal comma after a value expression. Keep
 * the check tokenizer/parser-backed so double commas and skipped bytes still
 * report.
 *
 * Liquid examples:
 *
 *   +{% cycle product.handle, %}+  => true
 *   +{% cycle product.handle,, %}+ => false
 */
export function hasRubyAcceptedCycleTrailingComma(markup: string): boolean {
  const tokens = tokensBeforeSingleTerminalComma(markup);
  return tokens !== null && parsesCompleteValueExpression(tokens, markup);
}

/**
 * Returns +true+ for a Ruby-accepted trailing comma in loop markup.
 *
 * This is used for +tablerow+ fallback markup. It validates the tokens before
 * the terminal comma with the parser's loop grammar instead of reconstructing
 * the shape from whitespace and delimiters.
 *
 * Liquid examples:
 *
 *   +{% tablerow product in products, %}+   => true
 *   +{% tablerow product in products,, %}+  => false
 */
export function hasRubyAcceptedLoopTrailingComma(markup: string): boolean {
  const tokens = tokensBeforeSingleTerminalComma(markup);
  if (tokens === null) return false;

  const parser = markupParserForTokens(tokens, markup);

  try {
    parser.consume(MarkupTokenType.Id);
    if (!parser.id('in')) return false;
    parser.valueExpression();
    parser.id('reversed');

    while (!parser.isAtEnd()) {
      parser.consumeOptional(MarkupTokenType.Comma);
      parser.namedArgument();
    }
  } catch {
    return false;
  }

  return parser.isAtEnd();
}

/**
 * Returns +true+ for a Ruby-accepted trailing comma in +paginate+ markup.
 *
 * The parser still owns the +collection by page_size+ grammar. This helper
 * only treats one tokenizer-confirmed terminal comma as Ruby-accepted.
 *
 * Liquid examples:
 *
 *   +{% paginate products by 12, %}+   => true
 *   +{% paginate products by 12,, %}+  => false
 */
export function hasRubyAcceptedPaginateTrailingComma(markup: string): boolean {
  const tokens = tokensBeforeSingleTerminalComma(markup);
  if (tokens === null) return false;

  const parser = markupParserForTokens(tokens, markup);

  try {
    parser.valueExpression();
    if (!parser.id('by')) return false;
    parser.valueExpression();

    if (parser.consumeOptional(MarkupTokenType.Comma)) {
      parser.namedArguments();
    }
  } catch {
    return false;
  }

  return parser.isAtEnd();
}

export function hasSingleTerminalComma(markup: string): boolean {
  return tokensBeforeSingleTerminalComma(markup) !== null;
}

export function hasConsecutiveCommaTokens(markup: string): boolean {
  const tokens = meaningfulTokens(markup);

  return tokens.some((token, index) => {
    return (
      token.type === MarkupTokenType.Comma && tokens[index + 1]?.type === MarkupTokenType.Comma
    );
  });
}

export function hasTrailingParsedConditionalMarkup(
  source: string,
  parsedEnd: number,
  markupEnd: number,
): boolean {
  const trailingMarkup = source.slice(parsedEnd, markupEnd);

  return hasSkippedCharacters(trailingMarkup) || meaningfulTokens(trailingMarkup).length > 0;
}

export function hasSingleTrailingConditionalToken(markup: string): boolean {
  const tokens = meaningfulTokens(markup);
  if (tokens.length === 0) return false;

  const lastToken = tokens[tokens.length - 1];
  if (hasCompleteVariableLookup(tokens)) {
    return hasSkippedCharacters(markup.slice(lastToken.end));
  }

  return hasCompleteVariableLookup(tokens.slice(0, -1)) && !hasSkippedCharacters(markup);
}

export function hasInvalidLogicalOperandMarkup(markup: string): boolean {
  const tokens = meaningfulTokens(markup);

  return tokens.some((token, index) => {
    if (!isLogicalToken(token)) return false;

    const prefix = markup.slice(0, token.start);
    if (!hasCompleteConditionalPrefix(tokens.slice(0, index), prefix)) return false;

    const suffix = markup.slice(token.end);
    return hasOnlyInvalidLogicalOperandMarkup(suffix);
  });
}

export function hasInvalidComparisonRhsMarkup(markup: string): boolean {
  const tokens = meaningfulTokens(markup);
  const lastToken = tokens[tokens.length - 1];

  if (!lastToken) return false;

  if (hasSkippedCharacters(markup) && hasInvalidComparisonRhsSkippedMarkup(tokens, markup)) {
    return true;
  }

  if (hasSkippedCharacters(markup) && isTerminalSkippedComparisonToken(markup, lastToken.end)) {
    return hasCompleteComparisonPrefix(tokens, markup.slice(0, lastToken.end));
  }

  if (isComparisonToken(lastToken)) {
    return hasCompleteComparisonPrefix(tokens.slice(0, -1), markup.slice(0, lastToken.start));
  }

  if (isInvalidComparisonRhsToken(lastToken)) {
    if (hasCompleteComparisonPrefix(tokens.slice(0, -1), markup.slice(0, lastToken.start))) {
      return true;
    }
  }

  return (
    hasInvalidComparisonRhsLookup(tokens, markup) ||
    hasInvalidComparisonRhsRangeLiteral(tokens, markup)
  );
}

export function hasInvalidBooleanComparisonRhsLookupMarkup(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);

  return tokens.some((token, index) => {
    if (!isComparisonToken(token)) return false;

    const prefixTokens = tokens.slice(0, index);
    if (!hasCompleteConditionalPrefix(prefixTokens, markup.slice(0, token.start))) return false;

    const rhsTokens = tokens.slice(index + 1);
    return hasInvalidVariableLookup(rhsTokens) || hasInvalidRangeLiteral(rhsTokens);
  });
}

export function hasInvalidBooleanComparisonRhsMarkup(markup: string): boolean {
  const tokens = meaningfulTokens(markup);

  return tokens.some((token, index) => {
    if (!isComparisonToken(token)) return false;

    const prefixTokens = tokens.slice(0, index);
    if (!hasCompleteBooleanComparisonPrefix(prefixTokens, markup.slice(0, token.start))) {
      return false;
    }

    const rhsTokens = tokens.slice(index + 1);
    if (hasSkippedCharacters(markup)) {
      return (
        (rhsTokens.length === 0 && isTerminalSkippedComparisonToken(markup, token.end)) ||
        hasOnlyInvalidComparisonRhsMarkup(markup.slice(token.end))
      );
    }

    return (
      rhsTokens.length === 0 ||
      hasBareBracketRhsTokens(rhsTokens) ||
      hasSingleComparisonRhsToken(rhsTokens) ||
      hasSingleInvalidComparisonRhsToken(rhsTokens)
    );
  });
}

export function hasInvalidBooleanExpressionComparisonMarkup(markup: string): boolean {
  const tokens = meaningfulTokens(markup);
  const lastToken = tokens[tokens.length - 1];
  if (!lastToken) return false;

  if (hasSkippedCharacters(markup)) {
    if (!isTerminalSkippedAngleComparisonToken(markup, lastToken.end)) return false;

    return hasCompleteBooleanComparisonPrefix(tokens, markup.slice(0, lastToken.end));
  }

  if (!isComparisonToken(lastToken)) return false;

  return hasCompleteBooleanComparisonPrefix(tokens.slice(0, -1), markup.slice(0, lastToken.start));
}

export function hasInvalidBooleanExpressionLookupMarkup(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);

  return tokens.some((token, index) => {
    if (index === 0) return false;

    const prefixTokens = tokens.slice(0, index);
    if (!hasCompleteBooleanComparisonPrefix(prefixTokens, markup.slice(0, token.start))) {
      return false;
    }

    const tailTokens = tokens.slice(index);
    return hasInvalidVariableLookup(tailTokens, true) || hasInvalidRangeLiteral(tailTokens);
  });
}

export function hasInvalidBooleanExpressionTokenMarkup(markup: string): boolean {
  const tokens = meaningfulTokens(markup);
  const lastToken = tokens[tokens.length - 1];

  if (!lastToken) return false;

  if (hasSkippedCharacters(markup)) {
    if (!isTerminalSkippedBooleanExpressionToken(markup, lastToken.end)) return false;

    return hasCompleteBooleanComparisonPrefix(tokens, markup.slice(0, lastToken.end));
  }

  if (!isInvalidBooleanExpressionToken(lastToken)) return false;
  if (lastToken.value === ']' && tokens.slice(0, -1).some((token) => token.value === '[')) {
    return false;
  }
  if (lastToken.value === ')' && hasUnclosedOpenRoundToken(tokens.slice(0, -1))) {
    return false;
  }

  return hasCompleteBooleanComparisonPrefix(tokens.slice(0, -1), markup.slice(0, lastToken.start));
}

export function hasInvalidBooleanExpressionLexerMarkup(markup: string): boolean {
  if (!hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);

  return tokens.some((token, index) => {
    const prefixTokens = tokens.slice(0, index + 1);
    if (!hasCompleteBooleanComparisonPrefix(prefixTokens, markup.slice(0, token.end))) {
      return false;
    }

    return hasOnlyInvalidComparisonRhsMarkup(markup.slice(token.end));
  });
}

export function hasInvalidConditionalLookupMarkup(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  return hasInvalidVariableLookup(meaningfulTokens(markup), true);
}

export function hasInvalidStandaloneConditionalRangeMarkup(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  return hasInvalidRangeLiteral(meaningfulTokens(markup));
}

export function hasInvalidStandaloneConditionalLexerMarkup(markup: string): boolean {
  if (!hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  if (tokens.length === 0) return true;

  const start = firstNonWhitespaceIndex(markup);
  return isQuote(markup[start]) && countCharacter(markup, markup[start]) === 1;
}

export function hasInvalidStandaloneConditionalTokenMarkup(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  if (tokens.length === 0) return true;
  if (tokens.length !== 1) return false;

  return isInvalidStandaloneConditionalToken(tokens[0]);
}

function hasOnlyInvalidLogicalOperandMarkup(markup: string): boolean {
  if (!hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  if (tokens.length === 0) return true;

  const start = firstNonWhitespaceIndex(markup);
  return isQuote(markup[start]) && countCharacter(markup, markup[start]) === 1;
}

function hasInvalidComparisonRhsSkippedMarkup(tokens: MarkupToken[], markup: string): boolean {
  return tokens.some((token, index) => {
    if (!isComparisonToken(token)) return false;

    const prefixTokens = tokens.slice(0, index + 1);
    if (!hasCompleteComparisonPrefix(prefixTokens, markup.slice(0, token.end))) return false;

    return hasOnlyInvalidComparisonRhsMarkup(markup.slice(token.end));
  });
}

function hasOnlyInvalidComparisonRhsMarkup(markup: string): boolean {
  if (!hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  if (tokens.length === 0) return true;

  const start = firstNonWhitespaceIndex(markup);
  return isQuote(markup[start]) && countCharacter(markup, markup[start]) === 1;
}

/**
 * Returns +true+ for a Ruby-accepted empty first filter argument.
 *
 * Ruby Liquid accepts markup ending in a filter argument separator without
 * an argument value. Keep this tokenizer-based so skipped bytes still fail.
 *
 * Liquid examples:
 *
 *   +{{ product.title | append: }}+  => true
 *   +{{ product.title | append }}+   => false
 */
export function hasRubyAcceptedEmptyFirstFilterArgument(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  const tail = tokens.slice(-3);

  return (
    tail.length === 3 &&
    tail[0].type === MarkupTokenType.Pipe &&
    tail[1].type === MarkupTokenType.Id &&
    tail[2].type === MarkupTokenType.Colon
  );
}

/**
 * Returns +true+ for a Ruby-accepted +assign+ with an empty RHS.
 *
 * Liquid examples:
 *
 *   +{% assign handle = %}+      => true
 *   +{% assign = product %}+     => false
 */
export function hasRubyAcceptedEmptyAssignRhs(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);

  return (
    tokens.length === 2 &&
    tokens[0].type === MarkupTokenType.Id &&
    tokens[1].type === MarkupTokenType.Equality &&
    tokens[1].value === '='
  );
}

/**
 * Returns +true+ for a Ruby-accepted extra identifier before +=+.
 *
 * Ruby Liquid accepts an extra identifier between the assign target and
 * equals sign, then evaluates the RHS normally.
 *
 * Liquid examples:
 *
 *   +{% assign handle extra = product %}+  => true
 *   +{% assign handle 42 = product %}+     => false
 */
export function hasRubyAcceptedAssignLhsExtraIdentifier(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  if (
    tokens.length < 4 ||
    tokens[0].type !== MarkupTokenType.Id ||
    tokens[1].type !== MarkupTokenType.Id ||
    tokens[2].type !== MarkupTokenType.Equality ||
    tokens[2].value !== '='
  ) {
    return false;
  }

  return parsesCompleteValueExpression(tokens.slice(3), markup);
}

/**
 * Returns +true+ for a Ruby-accepted unmatched quote before an +assign+ LHS.
 *
 * Ruby Liquid ignores a single unmatched quote before the assign target. Keep
 * the exception assign-specific by requiring the markup to become a complete
 * ordinary assign expression after that one leading quote is removed.
 *
 * Liquid examples:
 *
 *   +{% assign "handle = product %}+  => true
 *   +{% assign " = product %}+        => false
 */
export function hasRubyAcceptedAssignLhsUnclosedQuote(markup: string): boolean {
  const start = firstNonWhitespaceIndex(markup);
  const quote = markup[start];
  if (!isQuote(quote)) return false;
  if (countCharacter(markup, quote) !== 1) return false;

  const normalizedMarkup = markup.slice(0, start) + markup.slice(start + 1);
  if (hasSkippedCharacters(normalizedMarkup)) return false;

  const tokens = meaningfulTokens(normalizedMarkup);
  if (
    tokens.length < 3 ||
    tokens[0].type !== MarkupTokenType.Id ||
    tokens[1].type !== MarkupTokenType.Equality ||
    tokens[1].value !== '='
  ) {
    return false;
  }

  return parsesCompleteValueExpression(tokens.slice(2), normalizedMarkup);
}

/**
 * Returns +true+ for Ruby-accepted +include+ snippet expressions.
 *
 * The JavaScript parser normally expects include snippets to be strings.
 * Ruby Liquid also accepts any complete value expression below.
 *
 * Liquid examples:
 *
 *   +{% include 42 %}+       => true
 *   +{% include (1..5) %}+   => true
 *   +{% include ? %}+        => false
 */
export function hasRubyAcceptedIncludeSnippetExpression(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  if (hasBareContainsTokens(tokens)) return false;
  if (hasCompleteSimpleValueExpression(tokens)) return true;
  if (hasCompleteVariableLookup(tokens)) return true;
  if (hasCompleteNegativeNumber(tokens)) return true;
  if (hasCompleteRangeLiteral(tokens)) return true;

  return false;
}

export function hasRubyAcceptedRawTagCloserWithMarkup(
  source: string,
  tagName: 'doc' | 'raw',
  startIndex = 0,
): boolean {
  for (const tag of liquidTagBodies(source, startIndex)) {
    const markup = liquidTagMarkup(tag.body);
    if (
      markup?.tagName === `end${tagName}` &&
      markup.remainingTokens.length > 0 &&
      !markup.hasSkippedCharacters
    ) {
      return hasBalancedRawTagRemainder(source, tagName, tag.end);
    }
  }

  return false;
}

function hasBalancedRawTagRemainder(
  source: string,
  tagName: 'doc' | 'raw',
  startIndex: number,
): boolean {
  let depth = 0;

  for (const tag of liquidTagBodies(source, startIndex)) {
    const markup = liquidTagMarkup(tag.body);
    if (!markup || markup.hasSkippedCharacters) continue;

    if (markup.tagName === tagName) {
      depth++;
      continue;
    }

    if (markup.tagName === `end${tagName}`) {
      depth--;
      if (depth < 0) return false;
    }
  }

  return depth === 0;
}

/**
 * Returns each tokenizer-owned Liquid tag body in +source+.
 *
 * The document tokenizer owns the +{%+ and +%}+ boundaries, including
 * whitespace-control delimiters. This helper exposes only complete tag
 * bodies and ranges so callers do not reconstruct tag boundaries with
 * delimiter scans.
 *
 * Liquid examples:
 *
 *   +{% raw %}{% endraw foo %}+  => bodies +" raw "+, +" endraw foo "+
 *   +{%- doc -%}+                => body +" doc "+
 */
export function liquidTagBodies(source: string, startIndex = 0): LiquidTagBody[] {
  const tokens = tokenize(source);
  const tags: LiquidTagBody[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (open.type !== TokenType.LiquidTagOpen || open.start < startIndex) {
      continue;
    }

    const text = tokens[i + 1];
    const close = text?.type === TokenType.Text ? tokens[i + 2] : text;
    if (!close || close.type !== TokenType.LiquidTagClose) continue;

    tags.push(liquidTagBody(source, open, text?.type === TokenType.Text ? text : undefined, close));
  }

  return tags;
}

/**
 * Returns the tokenizer-classified tag name and remaining markup tokens.
 *
 * The first markup +Id+ token is the tag name. The rest of the structure is
 * classified by markup tokens and skipped-character coverage, not by string
 * prefixes, whitespace slicing, or identifier character lists.
 *
 * Liquid examples:
 *
 *   +{% endraw foo %}+  => tagName +"endraw"+, one remaining token
 *   +{% docx %}+        => tagName +"docx"+, no remaining tokens
 */
export function liquidTagMarkup(body: string): LiquidTagMarkup | undefined {
  const tokens = meaningfulTokens(body);
  const tagName = tokens[0];

  if (!tagName || tagName.type !== MarkupTokenType.Id) return undefined;

  return {
    tagName: tagName.value,
    remainingTokens: tokens.slice(1),
    hasSkippedCharacters: hasSkippedCharacters(body),
  };
}

/**
 * Returns +true+ when +source+ contains a complete Liquid tag named
 * +tagName+.
 *
 * The document tokenizer owns tag boundaries, and the markup tokenizer owns
 * tag-name classification. This avoids raw substring checks that would
 * confuse text-only mentions or similarly-prefixed tag names with tags.
 *
 * Liquid examples:
 *
 *   +{% doc %}+      => true for +doc+
 *   +{% docx %}+     => false for +doc+
 *   +doc text only+  => false for +doc+
 */
export function hasLiquidTagNamed(source: string, tagName: string): boolean {
  for (const tag of liquidTagBodies(source)) {
    const markup = liquidTagMarkup(tag.body);
    if (markup?.tagName === tagName && !markup.hasSkippedCharacters) {
      return true;
    }
  }

  return false;
}

/**
 * Returns +true+ when the skipped prefix has unsupported bytes.
 *
 * Ruby Liquid ignores unmatched +'+ and +"+ bytes before the first parsed
 * token. Preserve that parity while still reporting any other skipped byte
 * in the prefix between +from+ and +to+.
 *
 * Liquid examples:
 *
 *   +{% assign @x = 1 %}+         => true   (+@+ is garbage)
 *   +{% assign "hello = x %}+     => false  (quote allowed)
 */
export function hasSkippedPrefixCharacters(source: string, from: number, to: number): boolean {
  return uncoveredCharacters(source.slice(from, to), true).length > 0;
}

/**
 * Returns +true+ for a Ruby-accepted skipped quote prefix.
 *
 * Ruby Liquid ignores unmatched quotes before the first parsed token only
 * when the quotes are separated from that token by whitespace. Keep the
 * check tokenizer-backed so token-bearing or garbage prefixes still fail.
 *
 * Liquid examples:
 *
 *   +{% unless ' product.available %}+   => true
 *   +{% unless 'product.available %}+    => false
 *   +{% unless ' foo product %}+         => false
 */
export function hasRubyAcceptedWhitespaceSeparatedQuotePrefix(prefix: string): boolean {
  if (meaningfulTokens(prefix).length > 0) return false;

  const uncovered = uncoveredCharacters(prefix);
  if (uncovered.length === 0 || uncovered.some(({ value }) => !isQuote(value))) {
    return false;
  }

  const lastQuote = uncovered[uncovered.length - 1];

  for (let index = lastQuote.end; index < prefix.length; index++) {
    if (isWhitespace(prefix[index])) return true;
  }

  return false;
}

export function hasUnclosedQuotedString(markup: string): boolean {
  return uncoveredCharacters(markup).some(({ value }) => isQuote(value));
}

function uncoveredCharacters(markup: string, allowPrefixQuotes = false): UncoveredCharacter[] {
  const tokens = tokenizeMarkup(markup);
  const covered = new Set<number>();
  const uncovered: UncoveredCharacter[] = [];

  for (const token of tokens) {
    if (token.type === MarkupTokenType.EndOfString) continue;

    for (let i = token.start; i < token.end; i++) {
      covered.add(i);
    }
  }

  for (let i = 0; i < markup.length; i++) {
    const ch = markup[i];
    if (isWhitespace(ch) || covered.has(i)) continue;
    if (allowPrefixQuotes && isQuote(ch)) continue;
    uncovered.push({ value: ch, start: i, end: i + 1 });
  }

  return uncovered;
}

function meaningfulTokens(markup: string): MarkupToken[] {
  return tokenizeMarkup(markup).filter((token) => token.type !== MarkupTokenType.EndOfString);
}

function inlineCommentLines(markup: string): InlineCommentLine[] {
  const tokenByOffset = tokenCoverage(markup);
  const lines: InlineCommentLine[] = [{ firstEvent: undefined }];
  let line = lines[0];

  for (let i = 0; i < markup.length; i++) {
    const ch = markup[i];

    if (ch === '\n') {
      line = { firstEvent: undefined };
      lines.push(line);
      continue;
    }

    if (isWhitespace(ch) || line.firstEvent) continue;

    const token = tokenByOffset.get(i);
    line.firstEvent = token
      ? { type: 'token', start: i, end: i + 1 }
      : { type: 'uncovered', value: ch, start: i, end: i + 1 };
  }

  return lines;
}

function tokenCoverage(markup: string): Map<number, MarkupToken> {
  const covered = new Map<number, MarkupToken>();

  for (const token of meaningfulTokens(markup)) {
    for (let i = token.start; i < token.end; i++) {
      covered.set(i, token);
    }
  }

  return covered;
}

function parsesCompleteValueExpression(tokens: MarkupToken[], source: string): boolean {
  const parser = markupParserForTokens(tokens, source);

  try {
    parser.valueExpression();
  } catch {
    return false;
  }

  return parser.isAtEnd();
}

function hasCompleteVariableLookup(tokens: MarkupToken[]): boolean {
  let index = 0;

  if (tokens[index]?.type !== MarkupTokenType.Id) return false;
  index++;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.value === '.') {
      if (tokens[index + 1]?.type !== MarkupTokenType.Id) return false;
      index += 2;
      continue;
    }

    if (token.value === '[') {
      const closeIndex = tokens.findIndex((candidate, candidateIndex) => {
        return candidateIndex > index && candidate.value === ']';
      });
      if (closeIndex === -1 || closeIndex === index + 1) return false;

      const bracketTokens = tokens.slice(index + 1, closeIndex);
      if (!hasCompleteBracketLookupExpression(bracketTokens)) return false;

      index = closeIndex + 1;
      continue;
    }

    return false;
  }

  return true;
}

function hasInvalidComparisonRhsLookup(tokens: MarkupToken[], markup: string): boolean {
  return tokens.some((token, index) => {
    if (!isComparisonToken(token)) return false;

    const prefixTokens = tokens.slice(0, index + 1);
    if (!hasCompleteComparisonPrefix(prefixTokens, markup.slice(0, token.end))) return false;

    return hasInvalidVariableLookup(tokens.slice(index + 1));
  });
}

function hasInvalidComparisonRhsRangeLiteral(tokens: MarkupToken[], markup: string): boolean {
  return tokens.some((token, index) => {
    if (!isComparisonToken(token)) return false;

    const prefixTokens = tokens.slice(0, index + 1);
    if (!hasCompleteComparisonPrefix(prefixTokens, markup.slice(0, token.end))) return false;

    return hasInvalidRangeLiteral(tokens.slice(index + 1));
  });
}

function hasInvalidVariableLookup(tokens: MarkupToken[], validateBracketContent = false): boolean {
  if (tokens[0]?.type !== MarkupTokenType.Id) return false;

  let index = 1;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.value === '.') {
      const property = tokens[index + 1];
      if (!property || property.type !== MarkupTokenType.Id) return true;
      index += 2;
      continue;
    }

    if (token.value === '[') {
      const closeIndex = tokens.findIndex((candidate, candidateIndex) => {
        return candidateIndex > index && candidate.value === ']';
      });
      if (closeIndex === -1) return true;
      if (
        validateBracketContent &&
        !hasCompleteBracketLookupExpression(tokens.slice(index + 1, closeIndex))
      ) {
        return true;
      }
      index = closeIndex + 1;
      continue;
    }

    return false;
  }

  return false;
}

function hasInvalidRangeLiteral(tokens: MarkupToken[]): boolean {
  if (tokens[0]?.value !== '(') return false;
  if (!hasCompleteRangeEndpoint([tokens[1]])) return false;

  const separator = tokens[2];
  const end = tokens[3];
  const close = tokens[4];

  if (!separator) return false;
  if (separator.value !== '..') {
    return close?.value === ')' && hasCompleteRangeEndpoint([end]);
  }

  if (!end) return false;
  if (end.value === ')') return true;

  if (!hasCompleteRangeEndpoint([end])) return false;

  return close?.value !== ')';
}

function hasCompleteBracketLookupExpression(tokens: MarkupToken[]): boolean {
  return (
    hasCompleteSimpleValueExpression(tokens) ||
    hasCompleteVariableLookup(tokens) ||
    hasCompleteNegativeNumber(tokens)
  );
}

function hasCompleteSimpleValueExpression(tokens: MarkupToken[]): boolean {
  if (tokens.length !== 1) return false;

  const token = tokens[0];
  return token.type === MarkupTokenType.Id || isNumberToken(token) || isQuotedStringToken(token);
}

function hasBareContainsTokens(tokens: MarkupToken[]): boolean {
  return (
    tokens.length === 1 && tokens[0].type === MarkupTokenType.Id && tokens[0].value === 'contains'
  );
}

function hasCompleteNegativeNumber(tokens: MarkupToken[]): boolean {
  return tokens.length === 2 && tokens[0].value === '-' && isNumberToken(tokens[1]);
}

function hasCompleteRangeLiteral(tokens: MarkupToken[]): boolean {
  return (
    tokens.length === 5 &&
    tokens[0].value === '(' &&
    tokens[2].value === '..' &&
    tokens[4].value === ')' &&
    hasCompleteRangeEndpoint([tokens[1]]) &&
    hasCompleteRangeEndpoint([tokens[3]])
  );
}

function hasCompleteRangeEndpoint(tokens: MarkupToken[]): boolean {
  return (
    hasCompleteSimpleValueExpression(tokens) ||
    hasCompleteVariableLookup(tokens) ||
    hasCompleteNegativeNumber(tokens)
  );
}

function isNumberToken(token: MarkupToken): boolean {
  return /^\d+(?:\.\d+)?$/.test(token.value);
}

function isQuotedStringToken(token: MarkupToken): boolean {
  return /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/.test(token.value);
}

function hasCompleteConditionalPrefix(tokens: MarkupToken[], source: string): boolean {
  if (tokens.length === 0 || hasSkippedCharacters(source)) return false;

  const lastToken = tokens[tokens.length - 1];

  return isConditionalValueEndingToken(lastToken);
}

function hasCompleteComparisonPrefix(tokens: MarkupToken[], source: string): boolean {
  if (tokens.length < 2 || hasSkippedCharacters(source)) return false;

  const comparisonToken = tokens[tokens.length - 1];
  if (!isComparisonToken(comparisonToken)) return false;

  return parsesCompleteValueExpression(tokens.slice(0, -1), source.slice(0, comparisonToken.start));
}

function hasCompleteBooleanComparisonPrefix(tokens: MarkupToken[], source: string): boolean {
  if (!tokens.some(isLogicalToken)) return false;

  return hasCompleteConditionalPrefix(tokens, source);
}

function hasBareBracketRhsTokens(tokens: MarkupToken[]): boolean {
  if (tokens[0]?.value !== '[') return false;

  const closeIndex = tokens.findIndex((candidate, candidateIndex) => {
    return candidateIndex > 0 && candidate.value === ']';
  });
  if (closeIndex === -1 || closeIndex !== tokens.length - 1) return false;

  return hasCompleteBracketLookupExpression(tokens.slice(1, closeIndex));
}

function hasSingleComparisonRhsToken(tokens: MarkupToken[]): boolean {
  return tokens.length === 1 && isComparisonToken(tokens[0]);
}

function hasSingleInvalidComparisonRhsToken(tokens: MarkupToken[]): boolean {
  return tokens.length === 1 && isInvalidComparisonRhsToken(tokens[0]);
}

function isConditionalValueEndingToken(token: MarkupToken): boolean {
  if (token.type === MarkupTokenType.Id || isNumberToken(token) || isQuotedStringToken(token)) {
    return true;
  }

  return token.value === ']' || token.value === ')';
}

function isLogicalToken(token: MarkupToken): boolean {
  return token.type === MarkupTokenType.Id && (token.value === 'and' || token.value === 'or');
}

function isComparisonToken(token: MarkupToken): boolean {
  return ['==', '!=', '<=', '>=', 'contains'].includes(token.value);
}

function isInvalidComparisonRhsToken(token: MarkupToken): boolean {
  return ['|', ',', ':', ']', ')', '?', '-', '.', '..'].includes(token.value);
}

function isInvalidBooleanExpressionToken(token: MarkupToken): boolean {
  return ['|', ',', ':', ']', ')', '?', '-', '..'].includes(token.value);
}

function isInvalidStandaloneConditionalToken(token: MarkupToken): boolean {
  return ['|', ',', ':', ']', ')', '-', '.', '..', 'contains'].includes(token.value);
}

function hasUnclosedOpenRoundToken(tokens: MarkupToken[]): boolean {
  const openCount = tokens.filter((token) => token.value === '(').length;
  const closeCount = tokens.filter((token) => token.value === ')').length;

  return openCount > closeCount;
}

function isTerminalSkippedComparisonToken(markup: string, start: number): boolean {
  const suffix = markup.slice(start).trim();

  return suffix === '<' || suffix === '>' || suffix === '?';
}

function isTerminalSkippedBooleanExpressionToken(markup: string, start: number): boolean {
  return markup.slice(start).trim() === '?';
}

function isTerminalSkippedAngleComparisonToken(markup: string, start: number): boolean {
  const suffix = markup.slice(start).trim();

  return suffix === '<' || suffix === '>';
}

function tokensBeforeSingleTerminalComma(markup: string): MarkupToken[] | null {
  if (hasSkippedCharacters(markup)) return null;

  const tokens = meaningfulTokens(markup);
  const lastToken = tokens[tokens.length - 1];
  const previousToken = tokens[tokens.length - 2];

  if (
    tokens.length < 2 ||
    lastToken.type !== MarkupTokenType.Comma ||
    previousToken.type === MarkupTokenType.Comma
  ) {
    return null;
  }

  return tokens.slice(0, -1);
}

function markupParserForTokens(tokens: MarkupToken[], source: string): MarkupParser {
  return new MarkupParser([...tokens, endOfStringToken(source)], source);
}

function endOfStringToken(source: string): MarkupToken {
  return {
    type: MarkupTokenType.EndOfString,
    value: '',
    start: source.length,
    end: source.length,
  };
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

function firstNonWhitespaceIndex(markup: string): number {
  for (let i = 0; i < markup.length; i++) {
    if (!isWhitespace(markup[i])) return i;
  }

  return markup.length;
}

function countCharacter(markup: string, ch: string): number {
  let count = 0;

  for (const current of markup) {
    if (current === ch) count++;
  }

  return count;
}

function isQuote(ch: string): boolean {
  return ch === "'" || ch === '"';
}

function liquidTagBody(
  source: string,
  open: Token,
  text: Token | undefined,
  close: Token,
): LiquidTagBody {
  return {
    start: open.start,
    body: text ? source.slice(text.start, text.end) : '',
    bodyStart: text?.start ?? open.end,
    end: close.end,
  };
}

interface LiquidTagBody {
  start: number;
  body: string;
  bodyStart: number;
  end: number;
}

interface LiquidTagMarkup {
  tagName: string;
  remainingTokens: MarkupToken[];
  hasSkippedCharacters: boolean;
}

interface UncoveredCharacter {
  value: string;
  start: number;
  end: number;
}

interface InlineCommentLine {
  firstEvent: InlineCommentLineEvent | undefined;
}

type InlineCommentLineEvent =
  | { type: 'token'; start: number; end: number }
  | { type: 'uncovered'; value: string; start: number; end: number };
