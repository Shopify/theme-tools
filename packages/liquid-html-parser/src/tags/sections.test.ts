import { describe, expect, it } from 'vitest';
import { TagKind, type Parser } from '../environment';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import { NodeTypes } from '../types';
import { sectionsTag } from './sections';

const OFFSET = 100;
const PADDING = 'x'.repeat(OFFSET);

function parser(markup: string): MarkupParser {
  return new MarkupParser(tokenizeMarkup(markup, OFFSET), PADDING + markup);
}

const stubParser = {} as Parser;

describe('sectionsTag', () => {
  it('has standalone kind', () => {
    expect(sectionsTag.kind).toBe(TagKind.Tag);
  });

  it('parses a string expression', () => {
    const result = sectionsTag.parse('sections', parser("'header-group'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.String,
      value: 'header-group',
    });
  });
});
