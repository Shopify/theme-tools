import type { AssignMarkup } from '../ast';
import type { MarkupParser } from '../markup/parser';
import { MarkupTokenType } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { TagKind, type TagDefinitionTag, type Parser } from '../tag-definitions';

export const assignTag: TagDefinitionTag<AssignMarkup> = {
  kind: TagKind.Tag,
  parse(_name: string, markup: MarkupParser, _parser: Parser): AssignMarkup {
    const start = markup.peek().start;
    // Lax: Ruby's lax assign `Syntax = /(#{VariableSignature}+)\s*=\s*(.*)/om`
    // is unanchored, so `VariableSignature+` (`/\(?[\w\-\.\[\]]\)?/`: word
    // chars, dots, brackets, hyphens, parens) binds the LAST contiguous run of
    // signature chars immediately before `=`. Whitespace is not a signature
    // char, so when multiple tokens precede `=` Ruby keeps only the final run
    // and silently drops the rest: `{% assign foo bar = 'x' %}` assigns to
    // `bar`, not `foo bar` (verified against Ruby 5.11.0: renders `[][x]`).
    // Single-run names like `123foo`, `a.b` and `foo[bar]` are stored verbatim
    // as literal keys. The raw span up to `=` can carry tokenizer-skipped
    // whitespace, so extract the signature runs and keep the last one rather
    // than keying the whole span. This branch only runs during render-tree lax
    // recovery (markup.isLax()); strict parsing keeps the Id-only path so
    // `toLiquidHtmlAST` stays strict.
    let name: string;
    if (markup.isLax()) {
      const raw = markup.consumeRawUntil(MarkupTokenType.Equality);
      const runs = raw.match(/[\w\-.[\]()]+/g);
      name = runs ? runs[runs.length - 1] : '';
      if (name.length === 0) {
        throw new Error("Expected an assignment target before '=' in assign tag");
      }
    } else {
      name = markup.consume(MarkupTokenType.Id).value;
    }
    const eqToken = markup.consume(MarkupTokenType.Equality);
    if (eqToken.value !== '=') {
      throw new Error("Expected '=' in assign tag");
    }
    const value = markup.liquidVariable();
    return {
      type: NodeTypes.AssignMarkup,
      name,
      value,
      position: { start, end: markup.peek().start },
      source: value.source,
    };
  },
};
