import { describe, expect, it } from 'vitest';
import {
  commentRaw,
  docRaw,
  rawRaw,
  javascriptRaw,
  schemaRaw,
  styleRaw,
  stylesheetRaw,
} from './raw';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('commentRaw', () => {
  it('has raw kind', () => {
    expect(commentRaw.kind).toBe(TagKind.Raw);
  });

  it('does not parse liquid in body', () => {
    expect(commentRaw.parseLiquidInBody).toBe(false);
  });

  it('parses empty markup', () => {
    expect(() => commentRaw.parse('comment', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => commentRaw.parse('comment', parser('something'), stubParser)).toThrow(
      "'comment' tag does not accept markup",
    );
  });
});

describe('docRaw', () => {
  it('has raw kind', () => {
    expect(docRaw.kind).toBe(TagKind.Raw);
  });

  it('has undefined parseLiquidInBody (uses liquid-doc-parser)', () => {
    expect(docRaw.parseLiquidInBody).toBeUndefined();
  });

  it('parses empty markup', () => {
    expect(() => docRaw.parse('doc', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => docRaw.parse('doc', parser('something'), stubParser)).toThrow(
      "'doc' tag does not accept markup",
    );
  });
});

describe('rawRaw', () => {
  it('has raw kind', () => {
    expect(rawRaw.kind).toBe(TagKind.Raw);
  });

  it('does not parse liquid in body', () => {
    expect(rawRaw.parseLiquidInBody).toBe(false);
  });

  it('parses empty markup', () => {
    expect(() => rawRaw.parse('raw', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => rawRaw.parse('raw', parser('something'), stubParser)).toThrow(
      "'raw' tag does not accept markup",
    );
  });
});

describe('javascriptRaw', () => {
  it('has raw kind', () => {
    expect(javascriptRaw.kind).toBe(TagKind.Raw);
  });

  it('parses liquid in body', () => {
    expect(javascriptRaw.parseLiquidInBody).toBe(true);
  });

  it('parses empty markup', () => {
    expect(() => javascriptRaw.parse('javascript', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => javascriptRaw.parse('javascript', parser('something'), stubParser)).toThrow(
      "'javascript' tag does not accept markup",
    );
  });
});

describe('schemaRaw', () => {
  it('has raw kind', () => {
    expect(schemaRaw.kind).toBe(TagKind.Raw);
  });

  it('does not parse liquid in body', () => {
    expect(schemaRaw.parseLiquidInBody).toBe(false);
  });

  it('parses empty markup', () => {
    expect(() => schemaRaw.parse('schema', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => schemaRaw.parse('schema', parser('something'), stubParser)).toThrow(
      "'schema' tag does not accept markup",
    );
  });
});

describe('styleRaw', () => {
  it('has raw kind', () => {
    expect(styleRaw.kind).toBe(TagKind.Raw);
  });

  it('parses liquid in body', () => {
    expect(styleRaw.parseLiquidInBody).toBe(true);
  });

  it('parses empty markup', () => {
    expect(() => styleRaw.parse('style', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => styleRaw.parse('style', parser('something'), stubParser)).toThrow(
      "'style' tag does not accept markup",
    );
  });
});

describe('stylesheetRaw', () => {
  it('has raw kind', () => {
    expect(stylesheetRaw.kind).toBe(TagKind.Raw);
  });

  it('parses liquid in body', () => {
    expect(stylesheetRaw.parseLiquidInBody).toBe(true);
  });

  it('parses empty markup', () => {
    expect(() => stylesheetRaw.parse('stylesheet', parser(''), stubParser)).not.toThrow();
  });

  it('throws on non-empty markup', () => {
    expect(() => stylesheetRaw.parse('stylesheet', parser('something'), stubParser)).toThrow(
      "'stylesheet' tag does not accept markup",
    );
  });
});
