import type {
  RenderMarkup,
  RenderVariableExpression,
  RenderAliasExpression,
  LiquidNamedArgument,
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

function parseRenderMarkup(
  _name: string,
  markup: MarkupParser,
  _parser: Parser,
  allowAnyTemplateName = false,
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
  if (markup.id('for')) {
    kind = 'for';
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
      source: '',
    };
  }

  // Handle 'as alias' — may appear after 'with expr' / 'for expr' or standalone
  const asStart = markup.peek().start;
  if (markup.id('as')) {
    const aliasToken = markup.consume(MarkupTokenType.Id);
    alias = {
      type: NodeTypes.RenderAliasExpression,
      value: aliasToken.value,
      position: { start: asStart, end: aliasToken.end },
      source: '',
    };
  }

  const args: LiquidNamedArgument[] = [];
  // Commas between named args are optional in Ruby `render`/`include`
  // (render.rb / include.rb strict2_parse: `p.consume?(:comma)` after each
  // attribute). Both `{% render 'x', a: 1, b: 2 %}` and the space-separated
  // `{% render 'x' a: 1 b: 2 %}` are valid. This is a render/include-local loop
  // (NOT a change to the shared `namedArguments()`), so the strict AST for every
  // other tag — and theme-check-common's parse-error detection — is unaffected.
  markup.consumeOptional(MarkupTokenType.Comma);
  while (looksLikeNamedArgument(markup)) {
    args.push(markup.namedArgument());
    markup.consumeOptional(MarkupTokenType.Comma);
  }

  const end = markup.peek().start;

  return {
    type: NodeTypes.RenderMarkup,
    snippet,
    variable,
    alias,
    args,
    position: { start: snippet.position.start, end },
    source: '',
  };
}

export const renderTag: TagDefinitionTag<RenderMarkup> = {
  kind: TagKind.Tag,
  parse: parseRenderMarkup,
};

export const includeTag: TagDefinitionTag<RenderMarkup> = {
  kind: TagKind.Tag,
  parse: (name, markup, parser) => parseRenderMarkup(name, markup, parser, true),
};
