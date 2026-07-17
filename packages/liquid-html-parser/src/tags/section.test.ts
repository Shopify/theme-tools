import { describe, expect, it } from 'vitest';
import { sectionTag } from './section';
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

describe('sectionTag', () => {
  it('has hybrid kind', () => {
    expect(sectionTag.kind).toBe(TagKind.Hybrid);
  });

  it('parses section with name only', () => {
    const result = sectionTag.parse('section', parser("'header'"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.SectionMarkup,
      name: { type: NodeTypes.String, value: 'header' },
      args: [],
    });
  });

  it('sets position.end at eosToken.start, not last token end', () => {
    const markup = "'header' ";
    const result = sectionTag.parse('section', parser(markup), stubParser);
    expect(result.position.end).toBe(OFFSET + markup.length);
    expect(result.position.end).toBeGreaterThan(result.name.position.end);
  });

  it('sets position.end at eosToken.start with named args', () => {
    const markup = "'header', key: value ";
    const result = sectionTag.parse('section', parser(markup), stubParser);
    expect(result.position.end).toBe(OFFSET + markup.length);
    expect(result.position.end).toBeGreaterThan(result.args[result.args.length - 1].position.end);
  });

  it('parses section with named args', () => {
    const result = sectionTag.parse('section', parser("'header', key: value"), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.SectionMarkup,
      name: { type: NodeTypes.String, value: 'header' },
    });
    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'key',
      value: { type: NodeTypes.VariableLookup, name: 'value' },
    });
  });

  it('parses section setting args with array values', () => {
    const result = sectionTag.parse(
      'section',
      parser("'header', section.settings.products: ['classic-crewneck', 'cozy-beanie']"),
      stubParser,
    );

    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'section.settings.products',
      value: {
        type: 'BlockArrayLiteral',
        elements: [
          { type: NodeTypes.String, value: 'classic-crewneck' },
          { type: NodeTypes.String, value: 'cozy-beanie' },
        ],
      },
    });
  });
});
