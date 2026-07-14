import { describe, expect, it } from 'vitest';
import { forTag, tablerowTag } from './for';
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

describe('forTag', () => {
  it('has block kind', () => {
    expect(forTag.kind).toBe(TagKind.Block);
  });

  it('has else branch', () => {
    expect(forTag.branches).toEqual(['else']);
  });

  it('parses basic for loop', () => {
    const markup = 'item in collection';
    const source = PADDING + markup;
    const result = forTag.parse('for', parser(markup), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.VariableLookup, name: 'collection' },
      reversed: false,
      args: [],
    });
    // ForMarkup position spans from variable name to end of markup
    expect(source.slice(result.position.start, result.position.end)).toBe(markup);
  });

  it('parses for loop with reversed', () => {
    const result = forTag.parse('for', parser('item in collection reversed'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.VariableLookup, name: 'collection' },
      reversed: true,
      args: [],
    });
  });

  it('parses for loop with named args', () => {
    const result = forTag.parse('for', parser('item in collection limit:5 offset:2'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.VariableLookup, name: 'collection' },
      reversed: false,
    });
    expect(result.args).toHaveLength(2);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'limit',
      value: { type: NodeTypes.Number, value: '5' },
    });
    expect(result.args[1]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'offset',
      value: { type: NodeTypes.Number, value: '2' },
    });
  });

  it('parses for loop with reversed and named args', () => {
    const result = forTag.parse(
      'for',
      parser('item in collection reversed limit:5 offset:2'),
      stubParser,
    );
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.VariableLookup, name: 'collection' },
      reversed: true,
    });
    expect(result.args).toHaveLength(2);
  });

  it('parses for loop with comma-separated named args', () => {
    const result = forTag.parse('for', parser('item in collection limit:5, offset:2'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.VariableLookup, name: 'collection' },
      reversed: false,
    });
    expect(result.args).toHaveLength(2);
    expect(result.args[0]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'limit',
      value: { type: NodeTypes.Number, value: '5' },
    });
    expect(result.args[1]).toMatchObject({
      type: NodeTypes.NamedArgument,
      name: 'offset',
      value: { type: NodeTypes.Number, value: '2' },
    });
  });

  it('parses for loop with mixed comma/space-separated named args', () => {
    const result = forTag.parse(
      'for',
      parser('item in collection reversed limit:5, offset:2 cols:3'),
      stubParser,
    );
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      reversed: true,
    });
    expect(result.args).toHaveLength(3);
    expect(result.args[0]).toMatchObject({ name: 'limit' });
    expect(result.args[1]).toMatchObject({ name: 'offset' });
    expect(result.args[2]).toMatchObject({ name: 'cols' });
  });

  it('parses range expression as collection', () => {
    const result = forTag.parse('for', parser('item in (1..5)'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.Range },
      reversed: false,
      args: [],
    });
  });
});

describe('tablerowTag', () => {
  it('has block kind', () => {
    expect(tablerowTag.kind).toBe(TagKind.Block);
  });

  it('has else branch', () => {
    expect(tablerowTag.branches).toEqual(['else']);
  });

  it('parses same structure as forTag', () => {
    const result = tablerowTag.parse('tablerow', parser('item in collection'), stubParser);
    expect(result).toMatchObject({
      type: NodeTypes.ForMarkup,
      variableName: 'item',
      collection: { type: NodeTypes.VariableLookup, name: 'collection' },
      reversed: false,
      args: [],
    });
  });
});
