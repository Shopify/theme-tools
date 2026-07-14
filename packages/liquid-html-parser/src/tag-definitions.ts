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
  Hybrid = 'hybrid',
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

export interface TagDefinitionHybrid<M = unknown> {
  kind: TagKind.Hybrid;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
}

export type TagDefinition<M = unknown> =
  | TagDefinitionBlock<M>
  | TagDefinitionTag<M>
  | TagDefinitionRaw<M>
  | TagDefinitionHybrid<M>;

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
