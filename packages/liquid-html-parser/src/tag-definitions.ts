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
}

export type TagDefinition<M = unknown> =
  | TagDefinitionBlock<M>
  | TagDefinitionTag<M>
  | TagDefinitionRaw<M>;

/**
 * Whether a stray `{% end<name> %}` for a registered tag is a structural parse
 * error. `endsection` is the exception: `section` is standalone, and Ruby
 * Liquid reports `{% endsection %}` as an unknown tag (the legacy block form
 * was removed), so it parses as an unknown tag and Theme Check reports it.
 */
export function isStructuralEndTag(innerName: string, def: { kind: string } | undefined): boolean {
  return def !== undefined && innerName !== 'section';
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
