import type { MarkupParser } from './markup/parser';
import type { LiquidStatement } from './ast';

export interface Parser {
  parseLiquidStatement(
    tagName: string,
    markupString: string,
    startOffset: number,
    ctx: LiquidLineContext,
  ): LiquidStatement;
}

export enum TagKind {
  Block = 'block',
  Tag = 'tag',
  Raw = 'raw',
}

export type BranchName = 'elsif' | 'else' | 'when';

export interface TagDefinitionBlock<M = unknown> {
  kind: TagKind.Block;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
  branches: BranchName[];
}

export interface TagDefinitionTag<M = unknown> {
  kind: TagKind.Tag;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
}

export interface TagDefinitionRaw<M = unknown> {
  kind: TagKind.Raw;
  /** true for javascript/style/stylesheet, false for raw/comment/schema. doc uses liquid-doc-parser. */
  parseLiquidInBody?: boolean;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
  /** Where this tag's body ends, following the Liquid tag class that parses it. */
  body: RawBodyRule;
}

/**
 * How a raw tag's body ends. Each Liquid tag class finds the end of its own body,
 * so the rule belongs to the tag, not to the parser.
 */
export interface RawBodyRule {
  /**
   * How a tag is named inside the body: `leading` reads the name at the start of a
   * `{% %}` token (`BlockBody::FullToken`); `trailing` reads the last tag in the
   * token and leaves any text before it in the body (`FullTokenPossiblyInvalid`).
   */
  delimiter: 'leading' | 'trailing';
  /** What an inner tag with the same name does: opens another level, is ignored, or is a syntax error. */
  sameName: 'nests' | 'ignored' | 'rejected';
  /** Inner tags whose bodies are skipped whole, each ending by its own rule. */
  opaque: readonly string[];
  /** Whether the body can close inside `{% liquid %}`, whose lines cannot hold a `{% %}` delimiter. */
  closesInLiquidTag: boolean;
}

/** The closing tag of a raw tag's body, as source offsets. */
export interface RawBodyEnd {
  tagStart: number;
  tagEnd: number;
  wsStart: '-' | '';
  wsEnd: '-' | '';
}

export type TagDefinition<M = unknown> =
  | TagDefinitionBlock<M>
  | TagDefinitionTag<M>
  | TagDefinitionRaw<M>;

/** Whether a stray `{% end<name> %}` for a registered tag is a structural parse error. */
export function isStructuralEndTag(_innerName: string, def: { kind: string } | undefined): boolean {
  return def !== undefined;
}

/** A parsed line from a {% liquid %} body. */
export interface LiquidLine {
  tagName: string;
  markup: string;
  markupOffset: number;
  nameOffset: number;
  lineEnd: number;
}

/** Shared mutable iterator over parsed lines within a {% liquid %} body. */
export interface LiquidLineContext {
  readonly lines: readonly LiquidLine[];
  index: number;
}
