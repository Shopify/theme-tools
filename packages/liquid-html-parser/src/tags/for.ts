import type { ForMarkup, LiquidNamedArgument } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionBlock, type Parser } from '../tag-definitions';

function parseForMarkup(_name: string, markup: MarkupParser, _parser: Parser): ForMarkup {
  const nameToken = markup.consume(MarkupTokenType.Id);
  if (!markup.id('in')) {
    throw new Error("Expected 'in'");
  }
  const collection = markup.valueExpression();
  const reversed = markup.id('reversed');

  // Named args in for/tablerow accept optional commas between args
  // (matching Ruby's `p.consume?(:comma)` behavior).
  const args: LiquidNamedArgument[] = [];
  while (!markup.isAtEnd()) {
    markup.consumeOptional(MarkupTokenType.Comma);
    if (markup.isLax()) {
      // Lax recovery (render-tree only; `toLiquidHtmlAST` parses strict, so this
      // branch never runs there): Ruby's lax `tablerow`/`for` parse stops at the
      // first unparseable named argument and discards the rest rather than
      // erroring — e.g. `{% tablerow i in (1..5) limit: foo=>bar %}` keeps
      // `limit: foo` and drops `=>bar`. `namedArgument()` always consumes at
      // least its leading id or throws, so a throw is a clean stop that leaves
      // the already-parsed args intact (no infinite loop).
      try {
        args.push(markup.namedArgument());
      } catch {
        break;
      }
    } else {
      args.push(markup.namedArgument());
    }
  }

  return {
    type: NodeTypes.ForMarkup,
    variableName: nameToken.value,
    collection,
    reversed,
    args,
    position: { start: nameToken.start, end: markup.peek().start },
    source: collection.source,
  };
}

export const forTag: TagDefinitionBlock<ForMarkup> = {
  kind: TagKind.Block,
  branches: ['else'],
  parse: parseForMarkup,
};

export const tablerowTag: TagDefinitionBlock<ForMarkup> = {
  kind: TagKind.Block,
  branches: ['else'],
  parse: parseForMarkup,
};
