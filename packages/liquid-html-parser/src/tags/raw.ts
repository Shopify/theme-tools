import type { MarkupParser } from '../markup/parser';
import { TagKind, type Parser, type RawBodyRule, type TagDefinitionRaw } from '../tag-definitions';

// `Liquid::Raw` (raw, and liquid_extensions' javascript, schema and stylesheet)
// closes at the last tag of its first `end<name>` token, and cannot close inside
// `{% liquid %}`.
const LIQUID_RAW_BODY: RawBodyRule = {
  delimiter: 'trailing',
  sameName: 'ignored',
  opaque: [],
  closesInLiquidTag: false,
};

// `Liquid::Doc` reads tags like `Liquid::Raw` but rejects a nested `doc`.
const LIQUID_DOC_BODY: RawBodyRule = { ...LIQUID_RAW_BODY, sameName: 'rejected' };

// `Liquid::Comment#parse_body` counts nested comments and skips `raw` bodies.
const LIQUID_COMMENT_BODY: RawBodyRule = {
  delimiter: 'leading',
  sameName: 'nests',
  opaque: ['raw'],
  closesInLiquidTag: true,
};

// Shopify's `style` tag is a `Liquid::Block`, so its body nests like any block and
// the raw tags inside it end by their own rules.
const LIQUID_BLOCK_BODY: RawBodyRule = {
  delimiter: 'leading',
  sameName: 'nests',
  opaque: ['comment', 'doc', 'javascript', 'raw', 'schema', 'stylesheet'],
  closesInLiquidTag: true,
};

function parseNoMarkup(name: string, markup: MarkupParser, _parser: Parser): void {
  if (!markup.isAtEnd()) {
    throw new Error(`'${name}' tag does not accept markup`);
  }
}

export const commentRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_COMMENT_BODY,
  parseLiquidInBody: false,
  parse: parseNoMarkup,
};

// doc bodies are parsed separately by the liquid-doc-parser — parseLiquidInBody
// is intentionally omitted (undefined) so the parser can detect this and hand
// the body off to the doc-specific parser rather than the standard raw pipeline.
export const docRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_DOC_BODY,
  parse: parseNoMarkup,
};

export const rawRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_RAW_BODY,
  parseLiquidInBody: false,
  parse: parseNoMarkup,
};

export const javascriptRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_RAW_BODY,
  parseLiquidInBody: true,
  parse: parseNoMarkup,
};

export const schemaRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_RAW_BODY,
  parseLiquidInBody: false,
  parse: parseNoMarkup,
};

export const styleRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_BLOCK_BODY,
  parseLiquidInBody: true,
  parse: parseNoMarkup,
};

export const stylesheetRaw: TagDefinitionRaw<void> = {
  kind: TagKind.Raw,
  body: LIQUID_RAW_BODY,
  parseLiquidInBody: true,
  parse: parseNoMarkup,
};
