import { describe, expect, it } from 'vitest';
import { contentForTag } from './content-for';
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

describe('contentForTag', () => {
  it('has standalone kind', () => {
    expect(contentForTag.kind).toBe(TagKind.Tag);
  });

  it('parses content_for with type only', () => {
    const result = contentForTag.parse('content_for', parser("'header'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ContentForMarkup,
      contentForType: { type: NodeTypes.String, value: 'header' },
      args: [],
    });
  });

  it('sets position.end at eosToken.start, not last token end', () => {
    const markup = "'header' ";
    const result = contentForTag.parse('content_for', parser(markup), stubParser);
    // position.end should be eosToken.start (end of markup including trailing whitespace)
    // NOT contentForType.position.end (which would exclude trailing space)
    expect(result.position.end).toBe(OFFSET + markup.length);
    expect(result.position.end).toBeGreaterThan(result.contentForType.position.end);
  });

  it('sets position.end at eosToken.start with named args', () => {
    const markup = "'header', key: value ";
    const result = contentForTag.parse('content_for', parser(markup), stubParser);
    expect(result.position.end).toBe(OFFSET + markup.length);
    expect(result.position.end).toBeGreaterThan(result.args[result.args.length - 1].position.end);
  });

  it('parses content_for with named args', () => {
    const result = contentForTag.parse('content_for', parser("'header', key: value"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ContentForMarkup,
      contentForType: { type: NodeTypes.String, value: 'header' },
    });
    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'key',
      value: { type: NodeTypes.VariableLookup, name: 'value' },
    });
  });
});
