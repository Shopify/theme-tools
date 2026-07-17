import { describe, it, expect } from 'vitest';
import { NodeTypes } from '../types';
import type { TextNode, LiquidVariableOutput, LiquidHtmlNode, HtmlElement } from '../ast';
import { toLiquidHtmlAST } from '../ast';
import { makeTextNode, makeLiquidVariableOutput } from './factories';
import { tokenize, TokenType } from './tokenizer';
import { mergeAdjacentTextNodes, compoundNamesMatch } from './tree-builder';

const OFFSET = 5;
const PAD = 'x'.repeat(OFFSET);

function makeDropInSource(
  dropText: string,
  offset: number,
  fullSource: string,
): LiquidVariableOutput {
  const tokens = tokenize(dropText);
  const open = tokens.find((t) => t.type === TokenType.LiquidVariableOutputOpen)!;
  const close = tokens.find((t) => t.type === TokenType.LiquidVariableOutputClose)!;
  const markup = dropText.slice(open.end, close.start).trim();
  const adjustedOpen = { ...open, start: open.start + offset, end: open.end + offset };
  const adjustedClose = { ...close, start: close.start + offset, end: close.end + offset };
  return makeLiquidVariableOutput(adjustedOpen, adjustedClose, markup, fullSource);
}

/** Parse `<{%tag%}>x</{%tag%}>` and return the LiquidTag node from the open tag's compound name. */
function makeLiquidTagInName(tagSource: string): LiquidHtmlNode {
  const ast = toLiquidHtmlAST(`<${tagSource}>x</${tagSource}>`);
  const el = ast.children[0] as HtmlElement;
  return el.name[0];
}

describe('Unit: tree-builder', () => {
  describe('mergeAdjacentTextNodes', () => {
    it('returns empty array for empty input', () => {
      const source = PAD;
      const result = mergeAdjacentTextNodes([], source);
      expect(result).toEqual([]);
    });

    it('returns single TextNode unchanged', () => {
      const source = PAD + 'hello' + PAD;
      const node = makeTextNode('hello', OFFSET, OFFSET + 5, source);
      const result = mergeAdjacentTextNodes([node], source);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(node);
    });

    it('merges two adjacent TextNodes', () => {
      const source = PAD + 'hello world' + PAD;
      const a = makeTextNode('hello ', OFFSET, OFFSET + 6, source);
      const b = makeTextNode('world', OFFSET + 6, OFFSET + 11, source);
      const result = mergeAdjacentTextNodes([a, b], source);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(NodeTypes.TextNode);
      expect((result[0] as TextNode).value).toBe('hello world');
      expect(result[0].position.start).toBe(OFFSET);
      expect(result[0].position.end).toBe(OFFSET + 11);
      expect(source.slice(result[0].position.start, result[0].position.end)).toBe('hello world');
    });

    it('merges three adjacent TextNodes', () => {
      const source = PAD + 'abc' + PAD;
      const a = makeTextNode('a', OFFSET, OFFSET + 1, source);
      const b = makeTextNode('b', OFFSET + 1, OFFSET + 2, source);
      const c = makeTextNode('c', OFFSET + 2, OFFSET + 3, source);
      const result = mergeAdjacentTextNodes([a, b, c], source);
      expect(result).toHaveLength(1);
      expect((result[0] as TextNode).value).toBe('abc');
      expect(result[0].position).toEqual({ start: OFFSET, end: OFFSET + 3 });
      expect(source.slice(result[0].position.start, result[0].position.end)).toBe('abc');
    });

    it('preserves non-TextNode between TextNodes (no merging across boundary)', () => {
      const source = PAD + 'hello{{ x }}world' + PAD;
      const text1 = makeTextNode('hello', OFFSET, OFFSET + 5, source);
      const drop = makeDropInSource('{{ x }}', OFFSET + 5, source);
      const text2 = makeTextNode('world', OFFSET + 12, OFFSET + 17, source);
      const result = mergeAdjacentTextNodes([text1, drop, text2], source);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(text1);
      expect(result[1]).toBe(drop);
      expect(result[2]).toBe(text2);
    });

    it('merges only adjacent TextNodes in mixed array', () => {
      const source = PAD + 'ab{{ x }}cd' + PAD;
      const a = makeTextNode('a', OFFSET, OFFSET + 1, source);
      const b = makeTextNode('b', OFFSET + 1, OFFSET + 2, source);
      const drop = makeDropInSource('{{ x }}', OFFSET + 2, source);
      const c = makeTextNode('c', OFFSET + 9, OFFSET + 10, source);
      const d = makeTextNode('d', OFFSET + 10, OFFSET + 11, source);
      const result = mergeAdjacentTextNodes([a, b, drop, c, d], source);
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe(NodeTypes.TextNode);
      expect((result[0] as TextNode).value).toBe('ab');
      expect(result[0].position).toEqual({ start: OFFSET, end: OFFSET + 2 });
      expect(source.slice(result[0].position.start, result[0].position.end)).toBe('ab');
      expect(result[1]).toBe(drop);
      expect(result[2].type).toBe(NodeTypes.TextNode);
      expect((result[2] as TextNode).value).toBe('cd');
      expect(source.slice(result[2].position.start, result[2].position.end)).toBe('cd');
    });

    it('returns non-text-only array unchanged', () => {
      const source = PAD + '{{ a }}{{ b }}' + PAD;
      const drop1 = makeDropInSource('{{ a }}', OFFSET, source);
      const drop2 = makeDropInSource('{{ b }}', OFFSET + 7, source);
      const result = mergeAdjacentTextNodes([drop1, drop2], source);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(drop1);
      expect(result[1]).toBe(drop2);
    });

    it('merges all TextNodes when entire array is TextNodes', () => {
      const source = PAD + 'abcd' + PAD;
      const nodes = ['a', 'b', 'c', 'd'].map((ch, i) =>
        makeTextNode(ch, OFFSET + i, OFFSET + i + 1, source),
      );
      const result = mergeAdjacentTextNodes(nodes, source);
      expect(result).toHaveLength(1);
      expect((result[0] as TextNode).value).toBe('abcd');
      expect(source.slice(result[0].position.start, result[0].position.end)).toBe('abcd');
    });
  });

  describe('compoundNamesMatch', () => {
    it('returns true for two empty arrays', () => {
      expect(compoundNamesMatch([], [])).toBe(true);
    });

    it('returns true for matching single TextNode names', () => {
      const source = PAD + 'div' + PAD;
      const a = [makeTextNode('div', OFFSET, OFFSET + 3, source)];
      const b = [makeTextNode('div', OFFSET, OFFSET + 3, source)];
      expect(compoundNamesMatch(a, b)).toBe(true);
    });

    it('returns false for different TextNode values', () => {
      const source = PAD + 'divspan' + PAD;
      const a = [makeTextNode('div', OFFSET, OFFSET + 3, source)];
      const b = [makeTextNode('span', OFFSET + 3, OFFSET + 7, source)];
      expect(compoundNamesMatch(a, b)).toBe(false);
    });

    it('returns false for different array lengths', () => {
      const source = PAD + 'div' + PAD;
      const a = [makeTextNode('div', OFFSET, OFFSET + 3, source)];
      expect(compoundNamesMatch(a, [])).toBe(false);
    });

    it('returns true for matching compound name with LiquidVariableOutput', () => {
      const source = PAD + 'header-{{ type }}' + PAD;
      const textA = makeTextNode('header-', OFFSET, OFFSET + 7, source);
      const dropA = makeDropInSource('{{ type }}', OFFSET + 7, source);
      const textB = makeTextNode('header-', OFFSET, OFFSET + 7, source);
      const dropB = makeDropInSource('{{ type }}', OFFSET + 7, source);
      expect(compoundNamesMatch([textA, dropA], [textB, dropB])).toBe(true);
    });

    it('returns false when LiquidVariableOutput markup differs', () => {
      const sourceA = PAD + '{{ type }}' + PAD;
      const sourceB = PAD + '{{ kind }}' + PAD;
      const dropA = makeDropInSource('{{ type }}', OFFSET, sourceA);
      const dropB = makeDropInSource('{{ kind }}', OFFSET, sourceB);
      expect(compoundNamesMatch([dropA], [dropB])).toBe(false);
    });

    it('returns false when node types differ at same index', () => {
      const sourceText = PAD + 'div' + PAD;
      const sourceDrop = PAD + '{{ x }}' + PAD;
      const text = makeTextNode('div', OFFSET, OFFSET + 3, sourceText);
      const drop = makeDropInSource('{{ x }}', OFFSET, sourceDrop);
      expect(compoundNamesMatch([text], [drop])).toBe(false);
      expect(compoundNamesMatch([drop], [text])).toBe(false);
    });

    it('matches by markup string regardless of position', () => {
      const sourceA = PAD + '{{ type }}' + PAD;
      const sourceB = 'xx' + '{{ type }}' + PAD;
      const dropA = makeDropInSource('{{ type }}', OFFSET, sourceA);
      const dropB = makeDropInSource('{{ type }}', 2, sourceB);
      expect(compoundNamesMatch([dropA], [dropB])).toBe(true);
    });

    it('returns true for matching LiquidTag nodes (same source text)', () => {
      const tagA = makeLiquidTagInName('{% if true %}x{% endif %}');
      const tagB = makeLiquidTagInName('{% if true %}x{% endif %}');
      expect(compoundNamesMatch([tagA], [tagB])).toBe(true);
    });

    it('returns true for wholly-LiquidTag names even when branch content differs (Ruby parity)', () => {
      // The rendered tag name is decided at runtime by the Liquid block, so it
      // cannot be matched statically. Ruby's parser does not enforce open/close
      // matching for Liquid-interpolated names; the editor trusts the pair.
      const tagA = makeLiquidTagInName('{% if true %}x{% endif %}');
      const tagB = makeLiquidTagInName('{% if true %}y{% endif %}');
      expect(compoundNamesMatch([tagA], [tagB])).toBe(true);
    });

    it('returns false when LiquidTag vs LiquidVariableOutput at same index', () => {
      const tag = makeLiquidTagInName('{% if true %}x{% endif %}');
      const sourceDrop = PAD + '{{ x }}' + PAD;
      const drop = makeDropInSource('{{ x }}', OFFSET, sourceDrop);
      expect(compoundNamesMatch([tag], [drop])).toBe(false);
      expect(compoundNamesMatch([drop], [tag])).toBe(false);
    });
  });
});
