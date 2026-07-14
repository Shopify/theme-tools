import { describe, it, expect } from 'vitest';
import { parseLiquidDoc } from './parser';
import type { LiquidDocNode } from './parser';
import { NodeTypes } from '../types';
import type {
  LiquidDocParamNode,
  LiquidDocDescriptionNode,
  LiquidDocExampleNode,
  LiquidDocPromptNode,
  TextNode,
} from '../ast';

/**
 * Helper: simulates the body extraction from `{% doc %}BODY{% enddoc %}`.
 *
 * In a real parse, the document tokenizer provides the body string and offset.
 * Here we construct them manually. The `source` is the full document string.
 * The `body` is the content between the tags. `startOffset` is the position
 * of the body's first character in source.
 */
function parseDoc(body: string): LiquidDocNode[] {
  // Simulate: source = `{% doc %}${body}{% enddoc %}`
  const prefix = '{% doc %}';
  const suffix = '{% enddoc %}';
  const source = prefix + body + suffix;
  const startOffset = prefix.length;
  return parseLiquidDoc(body, startOffset, source);
}

function asParam(node: LiquidDocNode): LiquidDocParamNode {
  expect(node.type).toBe(NodeTypes.LiquidDocParamNode);
  return node as LiquidDocParamNode;
}

function asDescription(node: LiquidDocNode): LiquidDocDescriptionNode {
  expect(node.type).toBe(NodeTypes.LiquidDocDescriptionNode);
  return node as LiquidDocDescriptionNode;
}

function asExample(node: LiquidDocNode): LiquidDocExampleNode {
  expect(node.type).toBe(NodeTypes.LiquidDocExampleNode);
  return node as LiquidDocExampleNode;
}

function asPrompt(node: LiquidDocNode): LiquidDocPromptNode {
  expect(node.type).toBe(NodeTypes.LiquidDocPromptNode);
  return node as LiquidDocPromptNode;
}

function asText(node: LiquidDocNode): TextNode {
  expect(node.type).toBe(NodeTypes.TextNode);
  return node as TextNode;
}

describe('Unit: liquid-doc parser', () => {
  describe('empty doc', () => {
    it('produces no nodes for empty body', () => {
      const nodes = parseDoc('');
      expect(nodes).toEqual([]);
    });

    it('produces no nodes for whitespace-only body', () => {
      const nodes = parseDoc('\n  \n');
      expect(nodes).toEqual([]);
    });
  });

  describe('@param', () => {
    it('parses required param with no type or description', () => {
      const nodes = parseDoc('\n@param product\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.name).toBe('param');
      expect(param.paramName.value).toBe('product');
      expect(param.required).toBe(true);
      expect(param.paramType).toBe(null);
      expect(param.paramDescription).toBe(null);
    });

    it('parses optional param with brackets', () => {
      const nodes = parseDoc('\n@param [product]\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.paramName.value).toBe('product');
      expect(param.required).toBe(false);
    });

    it('parses param with type annotation', () => {
      const nodes = parseDoc('\n@param {string} product\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.paramType).not.toBe(null);
      expect(param.paramType!.value).toBe('string');
      expect(param.paramName.value).toBe('product');
      expect(param.required).toBe(true);
    });

    it('parses param with type and optional name', () => {
      const nodes = parseDoc('\n@param {number} [count]\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.paramType!.value).toBe('number');
      expect(param.paramName.value).toBe('count');
      expect(param.required).toBe(false);
    });

    it('parses param with description after dash', () => {
      const nodes = parseDoc('\n@param product - The product to display\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.paramName.value).toBe('product');
      expect(param.paramDescription).not.toBe(null);
      expect(param.paramDescription!.value).toContain('The product to display');
    });

    it('parses param with type, optional name, and description', () => {
      const nodes = parseDoc('\n@param {string} [title] - The page title\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.paramType!.value).toBe('string');
      expect(param.paramName.value).toBe('title');
      expect(param.required).toBe(false);
      expect(param.paramDescription!.value).toContain('The page title');
    });

    it('parses multiple params', () => {
      const nodes = parseDoc('\n@param product\n@param {number} count\n');
      expect(nodes.length).toBe(2);
      const p1 = asParam(nodes[0]);
      const p2 = asParam(nodes[1]);
      expect(p1.paramName.value).toBe('product');
      expect(p2.paramName.value).toBe('count');
      expect(p2.paramType!.value).toBe('number');
    });
  });

  describe('@example', () => {
    it('parses inline example', () => {
      const nodes = parseDoc('\n@example {{ product.title }}\n');
      expect(nodes.length).toBe(1);
      const example = asExample(nodes[0]);
      expect(example.name).toBe('example');
      expect(example.isInline).toBe(true);
      expect(example.content.value).toContain('{{ product.title }}');
    });

    it('parses multiline example', () => {
      const nodes = parseDoc('\n@example\n{{ product.title }}\n{{ product.price }}\n');
      expect(nodes.length).toBe(1);
      const example = asExample(nodes[0]);
      expect(example.isInline).toBe(false);
      expect(example.content.value).toContain('{{ product.title }}');
      expect(example.content.value).toContain('{{ product.price }}');
    });

    it('multiline example content continues until next annotation', () => {
      const nodes = parseDoc('\n@example\nline1\nline2\n@param product\n');
      expect(nodes.length).toBe(2);
      const example = asExample(nodes[0]);
      expect(example.content.value).toContain('line1');
      expect(example.content.value).toContain('line2');
      const param = asParam(nodes[1]);
      expect(param.paramName.value).toBe('product');
    });

    it('parses multiple examples', () => {
      const nodes = parseDoc('\n@example {{ a }}\n@example {{ b }}\n');
      expect(nodes.length).toBe(2);
      const e1 = asExample(nodes[0]);
      const e2 = asExample(nodes[1]);
      expect(e1.content.value).toContain('{{ a }}');
      expect(e2.content.value).toContain('{{ b }}');
    });

    it('position.end includes trailing blank lines before end-of-input', () => {
      // Regression: trailing newlines before enddoc were excluded from position.end
      const body = '\n@example\nline1\nline2\n\n';
      const prefix = '{% doc %}';
      const source = prefix + body + '{% enddoc %}';
      const nodes = parseLiquidDoc(body, prefix.length, source);
      expect(nodes.length).toBe(1);
      const example = asExample(nodes[0]);
      // The trailing blank line (\n\n at end) should be included in position.end
      const expectedEnd = prefix.length + body.length;
      expect(example.position.end).toBe(expectedEnd);
      expect(example.content.value).toContain('line1');
      expect(example.content.value).toContain('line2');
    });
  });

  describe('@description', () => {
    it('parses inline description', () => {
      const nodes = parseDoc('\n@description This is a thing\n');
      expect(nodes.length).toBe(1);
      const desc = asDescription(nodes[0]);
      expect(desc.name).toBe('description');
      expect(desc.isInline).toBe(true);
      expect(desc.isImplicit).toBe(false);
      expect(desc.content.value).toContain('This is a thing');
    });

    it('parses multiline description', () => {
      const nodes = parseDoc('\n@description\nLine one\nLine two\n');
      expect(nodes.length).toBe(1);
      const desc = asDescription(nodes[0]);
      expect(desc.isInline).toBe(false);
      expect(desc.isImplicit).toBe(false);
      expect(desc.content.value).toContain('Line one');
      expect(desc.content.value).toContain('Line two');
    });

    it('parses implicit description (text before first @)', () => {
      const nodes = parseDoc('\nThis is an implicit description\n@param product\n');
      expect(nodes.length).toBe(2);
      const desc = asDescription(nodes[0]);
      expect(desc.isImplicit).toBe(true);
      expect(desc.content.value).toContain('This is an implicit description');
      const param = asParam(nodes[1]);
      expect(param.paramName.value).toBe('product');
    });
  });

  describe('@prompt', () => {
    it('parses prompt with multiline content', () => {
      const nodes = parseDoc('\n@prompt\nBuild me a sale sticker\nwith a rotating symbol\n');
      expect(nodes.length).toBe(1);
      const prompt = asPrompt(nodes[0]);
      expect(prompt.name).toBe('prompt');
      expect(prompt.content.value).toContain('Build me a sale sticker');
      expect(prompt.content.value).toContain('with a rotating symbol');
    });

    it('prompt content starts with newline when annotation is on its own line', () => {
      const nodes = parseDoc('\n@prompt\nContent here\n');
      expect(nodes.length).toBe(1);
      const prompt = asPrompt(nodes[0]);
      // Content should start with \n because the annotation is on its own line
      expect(prompt.content.value[0]).toBe('\n');
    });
  });

  describe('unsupported annotations', () => {
    it('falls back to TextNode for unknown annotations', () => {
      const nodes = parseDoc('\n@unsupported some content\n');
      expect(nodes.length).toBe(1);
      const text = asText(nodes[0]);
      expect(text.value).toContain('@unsupported');
    });
  });

  describe('mixed annotations', () => {
    it('parses a mix of annotations in sequence', () => {
      const body = [
        '',
        'Implicit desc',
        '@param product - The product',
        '@param {number} [count]',
        '@example {{ product.title }}',
        '@description Explicit desc',
        '',
      ].join('\n');
      const nodes = parseDoc(body);

      // Implicit description
      const desc = asDescription(nodes[0]);
      expect(desc.isImplicit).toBe(true);
      expect(desc.content.value).toContain('Implicit desc');

      // First param
      const p1 = asParam(nodes[1]);
      expect(p1.paramName.value).toBe('product');
      expect(p1.paramDescription!.value).toContain('The product');

      // Second param
      const p2 = asParam(nodes[2]);
      expect(p2.paramName.value).toBe('count');
      expect(p2.required).toBe(false);

      // Example
      const ex = asExample(nodes[3]);
      expect(ex.content.value).toContain('{{ product.title }}');

      // Explicit description
      const descExplicit = asDescription(nodes[4]);
      expect(descExplicit.isImplicit).toBe(false);
      expect(descExplicit.content.value).toContain('Explicit desc');
    });
  });

  describe('paragraph break detection (Bug 35)', () => {
    it('stops @param description at blank line followed by free text', () => {
      const nodes = parseDoc('\n@param block - The block to render\n\nVideo from URL:\n');
      expect(nodes.length).toBe(2);
      const param = asParam(nodes[0]);
      expect(param.paramName.value).toBe('block');
      expect(param.paramDescription!.value).toContain('The block to render');
      expect(param.paramDescription!.value).not.toContain('Video');
      const text = asText(nodes[1]);
      expect(text.value).toContain('Video from URL:');
    });

    it('does not break on single newline between continuation lines', () => {
      const nodes = parseDoc('\n@param block - The block\ncontinuation line\n');
      expect(nodes.length).toBe(1);
      const param = asParam(nodes[0]);
      expect(param.paramDescription!.value).toContain('The block');
      expect(param.paramDescription!.value).toContain('continuation line');
    });

    it('implicit description spans across blank lines (golden behavior)', () => {
      const nodes = parseDoc('\nHeader text\n\nBody paragraph\n');
      // Golden: implicit descriptions include all text until @annotation
      expect(nodes.length).toBe(1);
      const desc = asDescription(nodes[0]);
      expect(desc.isImplicit).toBe(true);
      expect(desc.content.value).toContain('Header text');
      expect(desc.content.value).toContain('Body paragraph');
    });
  });

  describe('trailing newline behavior (Bug 35)', () => {
    it('param description trims trailing newlines', () => {
      const nodes = parseDoc('\n@param product - The product\n@example {{ x }}\n');
      expect(nodes.length).toBe(2);
      const param = asParam(nodes[0]);
      expect(param.paramDescription!.value).toBe('The product');
      expect(param.paramDescription!.value).not.toMatch(/\n$/);
    });

    it('param continuation stops at paragraph break', () => {
      const nodes = parseDoc('\n@param block - The block\n\nFree text after\n');
      const param = asParam(nodes[0]);
      expect(param.paramDescription!.value).toBe('The block');
      const text = asText(nodes[1]);
      expect(text.value).toContain('Free text after');
    });

    it('inline example with multiline content preserves trailing newlines', () => {
      const nodes = parseDoc('\n@example First line\nSecond line\n');
      expect(nodes.length).toBe(1);
      const example = asExample(nodes[0]);
      // Golden: multiline example content preserves trailing newlines
      expect(example.content.value).toMatch(/\n$/);
      expect(example.content.value).toContain('First line');
      expect(example.content.value).toContain('Second line');
    });

    it('free text between annotations trims trailing newlines', () => {
      // Free TextNodes in the parse loop trim trailing newlines
      const nodes = parseDoc('\nImplicit desc\n\n@param x\n');
      const desc = asDescription(nodes[0]);
      // Implicit descriptions preserve trailing newlines
      expect(desc.content.value).toMatch(/\n$/);
    });
  });
});
