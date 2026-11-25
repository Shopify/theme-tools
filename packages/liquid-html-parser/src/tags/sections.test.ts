import { describe, expect, it } from 'vitest';
import { sectionsTag } from './sections';
import { TagKind, type Parser } from '../environment';
import { tokenizeMarkup } from '../markup/tokenizer';
import { MarkupParser } from '../markup/parser';
import { NodeTypes } from '../types';

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
