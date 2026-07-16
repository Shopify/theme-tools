import {
  MarkupParser,
  NodeTypes,
  TokenType,
  tokenizeMarkup,
  tokenize,
  MarkupTokenType,
  type ComplexLiquidExpression,
  type LiquidArgument,
  type LiquidRawTag,
  type LiquidTag,
  type LiquidVariable,
  type LiquidConditionalExpression,
  type MarkupToken,
  type Token,
} from "@editor/liquid-html-parser";

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
  if ("loc" in error && error.loc) {
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
    if (source[i] === "\n") {
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
 * Returns +true+ when +markup+ is exactly one string token.
 *
 * This uses tokenizer tokens and skipped-character coverage rather than
 * trimming or comparing normalized markup strings. The expected +value+
 * excludes the surrounding quote characters.
 *
 * Liquid examples:
 *
 *   +{% stylesheet 'scss' %}+      => true for +scss+
 *   +{% stylesheet "scss" %}+      => true for +scss+
 *   +{% stylesheet scss %}+        => false
 *   +{% stylesheet 'scss' extra %}+ => false
 */
export function hasSingleStringMarkup(markup: string, value: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  const token = tokens[0];

  if (tokens.length !== 1 || token.type !== MarkupTokenType.String) {
    return false;
  }

  return token.value.slice(1, -1) === value;
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
    if (event.type === "uncovered" && event.value === "#") {
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
    if (!parser.id("in")) return false;
    parser.valueExpression();
    parser.id("reversed");

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
    if (!parser.id("by")) return false;
    parser.valueExpression();

    if (parser.consumeOptional(MarkupTokenType.Comma)) {
      parser.namedArguments();
    }
  } catch {
    return false;
  }

  return parser.isAtEnd();
}

/**
 * Returns +true+ for a Ruby-accepted empty first filter argument.
 *
 * Ruby Liquid accepts markup ending in a filter argument separator without
 * an argument value. Keep this tokenizer-based so skipped bytes still fail.
 *
 * Liquid examples:
 *
 *   +{{ product.title | append: }}+    => true
 *   +{{ product.title | append }}+     => false
 *   +{{ product.title foo | append: }}+ => false
 */
export function hasRubyAcceptedEmptyFirstFilterArgument(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = meaningfulTokens(markup);
  const tail = tokens.slice(-3);

  if (
    !(
      tail.length === 3 &&
      tail[0].type === MarkupTokenType.Pipe &&
      tail[1].type === MarkupTokenType.Id &&
      tail[2].type === MarkupTokenType.Colon
    )
  ) {
    return false;
  }

  const prefixTokens = tokens.slice(0, -3);

  return (
    parsesCompleteLiquidVariable(prefixTokens, markup) ||
    parsesCompleteAssignWithLiquidVariable(prefixTokens, markup)
  );
}

/**
 * Returns +true+ for a Ruby-accepted trailing comma in filter arguments.
 *
 * Ruby Liquid strict2 accepts one comma after a real filter argument when
 * followed by another filter or the end of the variable markup.
 *
 * Liquid examples:
 *
 *   +{{ n | f1: 1, 2, 3, | f2: }}+ => true
 *   +{{ n | f1: , | f2 }}+         => false
 */
export function hasRubyAcceptedFilterArgumentTrailingComma(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const tokens = removeFilterArgumentTrailingCommas(meaningfulTokens(markup));
  if (tokens === null) return false;

  return (
    parsesCompleteLiquidVariable(tokens, markup) ||
    parsesCompleteAssignWithLiquidVariable(tokens, markup) ||
    hasRubyAcceptedEmptyFirstFilterArgumentWithTokens(tokens, markup)
  );
}

function removeFilterArgumentTrailingCommas(tokens: MarkupToken[]): MarkupToken[] | null {
  let changed = false;
  const result: MarkupToken[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    if (
      token.type === MarkupTokenType.Comma &&
      (nextToken === undefined || nextToken.type === MarkupTokenType.Pipe)
    ) {
      if (
        !result
          .slice(result.findLastIndex((token) => token.type === MarkupTokenType.Pipe) + 1)
          .some((token) => token.type === MarkupTokenType.Colon)
      ) {
        return null;
      }

      const previousToken = result[result.length - 1];

      if (
        previousToken === undefined ||
        previousToken.type === MarkupTokenType.Comma ||
        previousToken.type === MarkupTokenType.Colon ||
        previousToken.type === MarkupTokenType.Pipe
      ) {
        return null;
      }

      changed = true;
      continue;
    }

    result.push(token);
  }

  return changed ? result : null;
}

function hasRubyAcceptedEmptyFirstFilterArgumentWithTokens(
  tokens: MarkupToken[],
  markup: string,
): boolean {
  const tail = tokens.slice(-3);

  if (
    !(
      tail.length === 3 &&
      tail[0].type === MarkupTokenType.Pipe &&
      tail[1].type === MarkupTokenType.Id &&
      tail[2].type === MarkupTokenType.Colon
    )
  ) {
    return false;
  }

  const prefixTokens = tokens.slice(0, -3);

  return (
    parsesCompleteLiquidVariable(prefixTokens, markup) ||
    parsesCompleteAssignWithLiquidVariable(prefixTokens, markup)
  );
}

function parsesCompleteLiquidVariable(tokens: MarkupToken[], source: string): boolean {
  const parser = markupParserForTokens(tokens, source);

  try {
    parser.liquidVariable();
  } catch {
    return false;
  }

  return parser.isAtEnd();
}

function parsesCompleteAssignWithLiquidVariable(tokens: MarkupToken[], source: string): boolean {
  if (
    tokens.length < 3 ||
    tokens[0].type !== MarkupTokenType.Id ||
    tokens[1].type !== MarkupTokenType.Equality ||
    tokens[1].value !== "="
  ) {
    return false;
  }

  const parser = markupParserForTokens(tokens.slice(2), source);

  try {
    parser.liquidVariable();
  } catch {
    return false;
  }

  return parser.isAtEnd();
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
    tokens[1].value === "="
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
    tokens[2].value !== "="
  ) {
    return false;
  }

  return parsesCompleteValueExpression(tokens.slice(3), markup);
}

/**
 * Returns +true+ for Ruby-accepted +include+ markup.
 *
 * The JavaScript parser normally expects include snippets to be strings.
 * Ruby Liquid also accepts any complete value expression, followed by
 * optional +for+/+with+ bindings, +as+ aliases, and named arguments.
 *
 * Liquid examples:
 *
 *   +{% include 42 %}+                         => true
 *   +{% include (1..5) for products as item %}+ => true
 *   +{% include ? %}+                          => false
 */
export function hasRubyAcceptedIncludeMarkup(markup: string): boolean {
  if (hasSkippedCharacters(markup)) return false;

  const parser = new MarkupParser(tokenizeMarkup(markup), markup);

  try {
    const snippet = parser.valueExpression();
    if (hasBareArrayAccess(snippet)) return false;

    if (parser.id("for") || parser.id("with")) {
      const binding = parser.valueExpression();
      if (hasBareArrayAccess(binding)) return false;
    }

    if (parser.id("as")) {
      parser.consume(MarkupTokenType.Id);
    }

    parser.consumeOptional(MarkupTokenType.Comma);
    while (parser.look(MarkupTokenType.Id)) {
      parser.consume(MarkupTokenType.Id);
      parser.consume(MarkupTokenType.Colon);

      const value = parser.valueExpression();
      if (hasBareArrayAccess(value)) return false;

      if (!parser.consumeOptional(MarkupTokenType.Comma)) break;
    }
  } catch {
    return false;
  }

  return parser.isAtEnd();
}

export function hasRubyAcceptedRawTagCloserWithMarkup(
  source: string,
  tagName: "doc" | "raw",
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
  tagName: "doc" | "raw",
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

export function liquidLineTagLocation(source: string, tagName: string): [number, number] | null {
  for (const tag of liquidTagBodies(source)) {
    const firstLineEnd = tag.body.indexOf("\n");
    if (firstLineEnd === -1) continue;

    const firstLineTokens = tokenizeMarkup(tag.body.slice(0, firstLineEnd), tag.bodyStart).filter(
      (token) => token.type !== MarkupTokenType.EndOfString,
    );
    const firstToken = firstLineTokens[0];
    if (firstToken?.type !== MarkupTokenType.Id || firstToken.value !== "liquid") continue;

    let lineStart = tag.bodyStart;
    for (const line of tag.body.split("\n")) {
      const tokens = tokenizeMarkup(line, lineStart).filter(
        (token) => token.type !== MarkupTokenType.EndOfString,
      );
      const firstToken = tokens[0];

      if (firstToken?.type === MarkupTokenType.Id && firstToken.value === tagName) {
        return [firstToken.start, lineStart + line.length];
      }

      lineStart += line.length + 1;
    }
  }

  return null;
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

    if (ch === "\n") {
      line = { firstEvent: undefined };
      lines.push(line);
      continue;
    }

    if (isWhitespace(ch) || line.firstEvent) continue;

    const token = tokenByOffset.get(i);
    line.firstEvent = token
      ? { type: "token", start: i, end: i + 1 }
      : { type: "uncovered", value: ch, start: i, end: i + 1 };
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
    value: "",
    start: source.length,
    end: source.length,
  };
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\r" || ch === "\t";
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
    body: text ? source.slice(text.start, text.end) : "",
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
  | { type: "token"; start: number; end: number }
  | { type: "uncovered"; value: string; start: number; end: number };
