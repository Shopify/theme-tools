import type { CycleMarkup, LiquidExpression } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionTag, type Parser } from '../tag-definitions';

export const cycleTag: TagDefinitionTag<CycleMarkup> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): CycleMarkup {
    const first = markup.valueExpression();
    let groupName: LiquidExpression | null = null;
    const args: LiquidExpression[] = [];

    if (markup.consumeOptional(MarkupTokenType.Colon)) {
      groupName = first;
      args.push(markup.valueExpression());
    } else {
      args.push(first);
    }

    while (markup.consumeOptional(MarkupTokenType.Comma)) {
      // Lax: tolerate a trailing comma (`{% cycle "1", "2", %}`). Ruby's
      // `variables_from_string` splits on commas and `.compact`s away the empty
      // trailing segment, and `strict2_parse` does `break if end_of_string`.
      // We only relax this on the lax-recovery path so strict `toLiquidHtmlAST`
      // output (consumed by the theme-check linter) is unchanged (DD-7): a
      // trailing comma stays a strict syntax error there.
      if (markup.isLax() && markup.isAtEnd()) break;
      args.push(markup.valueExpression());
    }

    return {
      type: NodeTypes.CycleMarkup,
      groupName,
      args,
      position: { start: first.position.start, end: markup.peek().start },
      source: first.source,
    };
  },
};
