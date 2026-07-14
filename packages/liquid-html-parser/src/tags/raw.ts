import type { MarkupParser } from '../markup/parser';
import { TagKind, type TagDefinitionRaw, type Parser } from '../tag-definitions';

function parseNoMarkup(name: string, markup: MarkupParser, _parser: Parser): void {
  if (!markup.isAtEnd()) {
    throw new Error(`'${name}' tag does not accept markup`);
  }
}

export const commentRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parseLiquidInBody: false,
  parse: parseNoMarkup,
};

// doc bodies are parsed separately by the liquid-doc-parser — parseLiquidInBody
// is intentionally omitted (undefined) so the parser can detect this and hand
// the body off to the doc-specific parser rather than the standard raw pipeline.
export const docRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parse: parseNoMarkup,
};

export const rawRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parseLiquidInBody: false,
  parse: parseNoMarkup,
};

export const javascriptRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parseLiquidInBody: true,
  parse: parseNoMarkup,
};

export const schemaRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parseLiquidInBody: false,
  parse: parseNoMarkup,
};

export const styleRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parseLiquidInBody: true,
  parse: parseNoMarkup,
};

export const stylesheetRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  parseLiquidInBody: true,
  parse: parseNoMarkup,
};
