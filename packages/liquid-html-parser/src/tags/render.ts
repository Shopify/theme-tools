import type {
  RenderMarkup,
  RenderVariableExpression,
  RenderAliasExpression,
  LiquidNamedArgument,
  LiquidVariableLookup,
} from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionTag, type Parser } from '../tag-definitions';

// Looks ahead for a render/include named-argument key at the current cursor.
// Ruby render/include strict2_parse keys are a BARE id immediately followed by a
// colon (`key = p.consume; p.consume(:colon)`) — NOT a dotted path. So we match
// only `Id Colon` here. A dotted key like `key.secondkey:` does not look like a
// named argument and is left unconsumed, which then fails the end-of-string check
// below (mirroring Ruby's `p.consume(:colon)` failure on `key.secondkey`).
function looksLikeNamedArgument(markup: MarkupParser): boolean {
  return markup.look(MarkupTokenType.Id) && markup.look(MarkupTokenType.Colon, 1);
}

function looksLikeLegacyWithNamedArgumentPrefix(
  markup: MarkupParser,
  allowWithNamedArgumentPrefix: boolean,
): boolean {
  return (
    allowWithNamedArgumentPrefix &&
    markup.peek().type === MarkupTokenType.Id &&
    markup.peek().value === 'with' &&
    markup.look(MarkupTokenType.Id, 1) &&
    markup.look(MarkupTokenType.Colon, 2)
  );
}

function parseAlias(markup: MarkupParser, source: string): RenderAliasExpression | null {
  const asStart = markup.peek().start;
  if (!markup.id('as')) return null;
  const aliasToken = markup.consume(MarkupTokenType.Id);
  return {
    type: NodeTypes.RenderAliasExpression,
    value: aliasToken.value,
    position: { start: asStart, end: aliasToken.end },
    source,
  };
}

function parseRenderNamedArguments(markup: MarkupParser, args: LiquidNamedArgument[]): void {
  // Commas between named args are optional in Ruby `render` and `include`.
  markup.consumeOptional(MarkupTokenType.Comma);
  while (looksLikeNamedArgument(markup)) {
    args.push(markup.namedArgument());
    markup.consumeOptional(MarkupTokenType.Comma);
  }
}

function parseRenderMarkup(
  _name: string,
  markup: MarkupParser,
  _parser: Parser,
  allowAnyTemplateName = false,
  allowWithNamedArgumentPrefix = false,
): RenderMarkup {
  const snippet = markup.valueExpression();
  // Ruby `render` requires a quoted string template name at parse time
  // (render.rb `strict2_template_name`: `p.consume(:string)`), whereas `include`
  // accepts any expression and only raises "Illegal template name" at render
  // time when it does not evaluate to a String (include.rb:40). So for `include`
  // we accept any value expression here and defer the type check to the
  // render-tree handler; `render` keeps the stricter parse-time restriction.
  if (
    !allowAnyTemplateName &&
    snippet.type !== NodeTypes.String &&
    snippet.type !== NodeTypes.VariableLookup
  ) {
    throw new Error(`Expected string or variable lookup for snippet, got ${snippet.type}`);
  }

  let variable: RenderVariableExpression | null = null;
  let alias: RenderAliasExpression | null = null;

  let kind: 'for' | 'with' | null = null;
  const kwStart = markup.peek().start;
  const hasWithNamedArgumentPrefix = looksLikeLegacyWithNamedArgumentPrefix(
    markup,
    allowWithNamedArgumentPrefix,
  );

  if (markup.id('for')) {
    kind = 'for';
  } else if (hasWithNamedArgumentPrefix) {
    // Shopify Liquid treats `with key: value` as both `with key` and a named argument.
    // Leave `key:` on the cursor so the named argument loop consumes it.
    const withToken = markup.consume(MarkupTokenType.Id);
    const nameToken = markup.peek();
    const name: LiquidVariableLookup = {
      type: NodeTypes.VariableLookup,
      name: nameToken.value,
      lookups: [],
      position: { start: nameToken.start, end: nameToken.end },
      source: snippet.source,
    };
    variable = {
      type: NodeTypes.RenderVariableExpression,
      kind: 'with',
      name,
      position: { start: withToken.start, end: nameToken.end },
      source: snippet.source,
    };
  } else if (markup.id('with')) {
    kind = 'with';
  }

  if (kind !== null) {
    const name = markup.valueExpression();
    variable = {
      type: NodeTypes.RenderVariableExpression,
      kind,
      name,
      position: { start: kwStart, end: name.position.end },
      source: name.source,
    };
  }

  // An alias can follow a regular `with` or `for` expression.
  alias = parseAlias(markup, snippet.source);

  const args: LiquidNamedArgument[] = [];
  parseRenderNamedArguments(markup, args);

  if (alias === null && hasWithNamedArgumentPrefix) {
    const lateAlias = parseAlias(markup, snippet.source);
    if (lateAlias !== null) {
      alias = lateAlias;
      parseRenderNamedArguments(markup, args);
    }
  }

  const end = markup.peek().start;

  return {
    type: NodeTypes.RenderMarkup,
    snippet,
    variable,
    alias,
    args,
    position: { start: snippet.position.start, end },
    source: snippet.source,
  };
}

export const renderTag: TagDefinitionTag<RenderMarkup> = {
  kind: TagKind.Tag,
  parse: (name, markup, parser) => parseRenderMarkup(name, markup, parser, false, true),
};

export const includeTag: TagDefinitionTag<RenderMarkup> = {
  kind: TagKind.Tag,
  parse: (name, markup, parser) => parseRenderMarkup(name, markup, parser, true, true),
};
