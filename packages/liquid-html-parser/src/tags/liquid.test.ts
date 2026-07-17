import { describe, expect, it } from 'vitest';
import { liquidTag } from './liquid';
import { TagKind, type Parser, type LiquidLineContext } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import type { LiquidStatement } from '../ast';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  const markupStart = OFFSET;
  const markupEnd = OFFSET + markup.length;
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup, markupStart, markupEnd);
}

function makeMockParser(): Parser {
  return {
    parseLiquidStatement(
      tagName: string,
      markupString: string,
      _startOffset: number,
      _ctx: LiquidLineContext,
    ): LiquidStatement {
      // Return a minimal stub that captures tag name and markup
      return {
        type: 'LiquidTag',
        name: tagName,
        markup: markupString,
      } as unknown as LiquidStatement;
    },
  };
}

describe('liquidTag', () => {
  it('has standalone kind', () => {
    expect(liquidTag.kind).toBe(TagKind.Tag);
  });

  it('returns empty array for empty markup', () => {
    const result = liquidTag.parse('liquid', parser(''), makeMockParser());
    expect(result).toEqual([]);
  });

  it('parses single line', () => {
    const result = liquidTag.parse('liquid', parser('\nassign x = 1\n'), makeMockParser());
    expect(result).toHaveLength(1);
    expect((result[0] as any).name).toBe('assign');
  });

  it('parses multiple lines', () => {
    const markup = '\nassign x = 1\necho x\n';
    const result = liquidTag.parse('liquid', parser(markup), makeMockParser());
    expect(result).toHaveLength(2);
    expect((result[0] as any).name).toBe('assign');
    expect((result[1] as any).name).toBe('echo');
  });

  it('skips empty lines', () => {
    const markup = '\n\nassign x = 1\n\n';
    const result = liquidTag.parse('liquid', parser(markup), makeMockParser());
    expect(result).toHaveLength(1);
    expect((result[0] as any).name).toBe('assign');
  });

  it('joins multiline tag with trailing comma and named args', () => {
    const markup = "\nrender 'foo',\n  bar: baz,\n  qux: quux\n";
    const result = liquidTag.parse('liquid', parser(markup), makeMockParser());
    expect(result).toHaveLength(1);
    expect((result[0] as any).name).toBe('render');
    expect((result[0] as any).markup).toContain('bar: baz');
    expect((result[0] as any).markup).toContain('qux: quux');
  });

  it('does not join lines when previous line has no trailing comma', () => {
    const markup = '\nassign x = 1\nassign y = 2\n';
    const result = liquidTag.parse('liquid', parser(markup), makeMockParser());
    expect(result).toHaveLength(2);
    expect((result[0] as any).name).toBe('assign');
    expect((result[1] as any).name).toBe('assign');
  });

  it('joins multiline include with named args', () => {
    const markup = "\ninclude 'snippet',\n  title: page.title,\n  count: 5\n";
    const result = liquidTag.parse('liquid', parser(markup), makeMockParser());
    expect(result).toHaveLength(1);
    expect((result[0] as any).name).toBe('include');
    expect((result[0] as any).markup).toContain('title: page.title');
  });

  it('handles multiline render followed by another statement', () => {
    const markup = "\nrender 'foo',\n  bar: baz\nassign x = 1\n";
    const result = liquidTag.parse('liquid', parser(markup), makeMockParser());
    expect(result).toHaveLength(2);
    expect((result[0] as any).name).toBe('render');
    expect((result[1] as any).name).toBe('assign');
  });
});
