import { describe, it, expect } from 'vitest';
import { tokenize, TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import {
  envelopeFromTokens,
  makeLiquidTagBaseCase,
  makeLiquidTagNamed,
  makeLiquidBranchUnnamed,
  makeLiquidBranchNamed,
  makeLiquidRawTag,
  makeTextNode,
  makeRawMarkup,
  makeLiquidVariableOutput,
  makeDocumentNode,
  makeYamlFrontmatter,
} from './factories';
import { NodeTypes, NamedTags, RawTags } from '../types';
import { RawMarkupKinds } from '../ast';

const OFFSET = 5;
const PAD = 'x'.repeat(OFFSET);

function findToken(tokens: Token[], type: TokenType): Token {
  const t = tokens.find((t) => t.type === type);
  if (!t) throw new Error(`No ${type} token found`);
  return t;
}

function findTokens(tokens: Token[], type: TokenType): Token[] {
  return tokens.filter((t) => t.type === type);
}

describe('Unit: document-factories', () => {
  describe('envelopeFromTokens', () => {
    it('extracts tag name and markup', () => {
      const source = PAD + '{% assign x = 1 %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);

      expect(envelope.tagName).toBe('assign');
      expect(envelope.markupString).toContain('x = 1');
      expect(source[envelope.markupOffset]).toBe('x');
      const bsp = envelope.blockStartPosition;
      expect(source.slice(bsp.start, bsp.end)).toBe('{% assign x = 1 %}');
      expect(envelope.source).toBe(source);
    });

    it('detects trim whitespace {%- tag -%}', () => {
      const source = PAD + '{%- assign x = 1 -%}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);

      expect(envelope.whitespaceStart).toBe('-');
      expect(envelope.whitespaceEnd).toBe('-');
    });

    it('detects no trim whitespace {% tag %}', () => {
      const source = PAD + '{% assign x = 1 %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);

      expect(envelope.whitespaceStart).toBe('');
      expect(envelope.whitespaceEnd).toBe('');
    });

    it('detects mixed whitespace {%- tag %}', () => {
      const source = PAD + '{%- tag %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);

      expect(envelope.whitespaceStart).toBe('-');
      expect(envelope.whitespaceEnd).toBe('');
    });

    it('detects mixed whitespace {% tag -%}', () => {
      const source = PAD + '{% tag -%}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);

      expect(envelope.whitespaceStart).toBe('');
      expect(envelope.whitespaceEnd).toBe('-');
    });

    it('handles tag with no markup', () => {
      const source = PAD + '{% break %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);

      expect(envelope.tagName).toBe('break');
      expect(envelope.markupString.trim()).toBe('');
    });

    it('blockStartPosition spans entire tag', () => {
      const source = PAD + '{% render "snippet" %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const bsp = envelope.blockStartPosition;

      expect(bsp.start).toBeGreaterThanOrEqual(OFFSET);
      expect(bsp.end).toBeGreaterThan(bsp.start);
      expect(source.slice(bsp.start, bsp.end)).toBe('{% render "snippet" %}');
    });
  });

  describe('makeTextNode', () => {
    it('creates TextNode with correct fields', () => {
      const source = PAD + 'hello world';
      const node = makeTextNode('hello', OFFSET, OFFSET + 5, source);

      expect(node.type).toBe(NodeTypes.TextNode);
      expect(node.value).toBe('hello');
      expect(node.position.start).toBe(OFFSET);
      expect(node.position.end).toBe(OFFSET + 5);
      expect(source.slice(node.position.start, node.position.end)).toBe('hello');
      expect(node.source).toBe(source);
    });

    it('handles whitespace value', () => {
      const source = PAD + '  \n  rest';
      const value = '  \n  ';
      const node = makeTextNode(value, OFFSET, OFFSET + value.length, source);

      expect(node.type).toBe(NodeTypes.TextNode);
      expect(node.value).toBe(value);
      expect(source.slice(node.position.start, node.position.end)).toBe(value);
    });

    it('handles single character', () => {
      const source = PAD + 'xyzabc';
      const node = makeTextNode('x', OFFSET, OFFSET + 1, source);

      expect(node.type).toBe(NodeTypes.TextNode);
      expect(node.value).toBe('x');
      expect(node.position.start).toBe(OFFSET);
      expect(node.position.end).toBe(OFFSET + 1);
      expect(source.slice(node.position.start, node.position.end)).toBe('x');
    });
  });

  describe('makeRawMarkup', () => {
    it('creates RawMarkup with javascript kind', () => {
      const source = PAD + 'var x;rest';
      const node = makeRawMarkup(
        RawMarkupKinds.javascript,
        'var x;',
        [],
        OFFSET,
        OFFSET + 6,
        source,
      );

      expect(node.type).toBe(NodeTypes.RawMarkup);
      expect(node.kind).toBe(RawMarkupKinds.javascript);
      expect(node.value).toBe('var x;');
      expect(node.nodes).toEqual([]);
      expect(source.slice(node.position.start, node.position.end)).toBe('var x;');
    });

    it('creates RawMarkup with css kind', () => {
      const source = PAD + '.a{}rest';
      const node = makeRawMarkup(RawMarkupKinds.css, '.a{}', [], OFFSET, OFFSET + 4, source);

      expect(node.type).toBe(NodeTypes.RawMarkup);
      expect(node.kind).toBe(RawMarkupKinds.css);
      expect(node.value).toBe('.a{}');
      expect(source.slice(node.position.start, node.position.end)).toBe('.a{}');
    });

    it('creates RawMarkup with text kind and nodes', () => {
      const source = PAD + 'hello world';
      const textChild = makeTextNode('hello', OFFSET, OFFSET + 5, source);
      const node = makeRawMarkup(
        RawMarkupKinds.text,
        'hello',
        [textChild],
        OFFSET,
        OFFSET + 5,
        source,
      );

      expect(node.type).toBe(NodeTypes.RawMarkup);
      expect(node.kind).toBe(RawMarkupKinds.text);
      expect(node.nodes.length).toBe(1);
      expect(source.slice(node.position.start, node.position.end)).toBe('hello');
    });

    it('position slice matches value', () => {
      const value = 'console.log(42);';
      const source = PAD + value + 'extra';
      const node = makeRawMarkup(
        RawMarkupKinds.javascript,
        value,
        [],
        OFFSET,
        OFFSET + value.length,
        source,
      );

      expect(source.slice(node.position.start, node.position.end)).toBe(value);
    });
  });

  describe('makeLiquidVariableOutput', () => {
    it('creates output for {{ x }}', () => {
      const source = PAD + '{{ x }}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidVariableOutputOpen);
      const close = findToken(tokens, TokenType.LiquidVariableOutputClose);
      const node = makeLiquidVariableOutput(open, close, ' x ', source);

      expect(node.type).toBe(NodeTypes.LiquidVariableOutput);
      expect(node.markup).toBe(' x ');
      expect(node.whitespaceStart).toBe('');
      expect(node.whitespaceEnd).toBe('');
      expect(node.source).toBe(source);
      expect(source.slice(node.markupPosition.start, node.markupPosition.end)).toBe(' x ');
      expect(source.slice(node.position.start, node.position.end)).toBe('{{ x }}');
    });

    it('detects trim {{- x -}}', () => {
      const source = PAD + '{{- x -}}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidVariableOutputOpen);
      const close = findToken(tokens, TokenType.LiquidVariableOutputClose);
      const node = makeLiquidVariableOutput(open, close, ' x ', source);

      expect(node.whitespaceStart).toBe('-');
      expect(node.whitespaceEnd).toBe('-');
      expect(source.slice(node.markupPosition.start, node.markupPosition.end)).toBe(' x ');
      expect(source.slice(node.position.start, node.position.end)).toBe('{{- x -}}');
    });

    it('sets empty output markup position', () => {
      const source = PAD + '{{}}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidVariableOutputOpen);
      const close = findToken(tokens, TokenType.LiquidVariableOutputClose);
      const node = makeLiquidVariableOutput(open, close, '', source);

      expect(source.slice(node.markupPosition.start, node.markupPosition.end)).toBe('');
      expect(source.slice(node.position.start, node.position.end)).toBe('{{}}');
    });

    it('detects mixed trim {{- x }}', () => {
      const source = PAD + '{{- x }}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidVariableOutputOpen);
      const close = findToken(tokens, TokenType.LiquidVariableOutputClose);
      const node = makeLiquidVariableOutput(open, close, ' x ', source);

      expect(node.whitespaceStart).toBe('-');
      expect(node.whitespaceEnd).toBe('');
    });

    it('detects mixed trim {{ x -}}', () => {
      const source = PAD + '{{ x -}}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidVariableOutputOpen);
      const close = findToken(tokens, TokenType.LiquidVariableOutputClose);
      const node = makeLiquidVariableOutput(open, close, ' x ', source);

      expect(node.whitespaceStart).toBe('');
      expect(node.whitespaceEnd).toBe('-');
      expect(source.slice(node.position.start, node.position.end)).toBe('{{ x -}}');
    });
  });

  describe('makeLiquidTagBaseCase', () => {
    it('creates standalone base-case tag', () => {
      const source = PAD + '{% unknown_tag %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const node = makeLiquidTagBaseCase(envelope);

      expect(node.type).toBe(NodeTypes.LiquidTag);
      expect(node.name).toBe('unknown_tag');
      expect(typeof node.markup).toBe('string');
      expect(node.children).toBe(undefined);
      expect(node.blockEndPosition).toBe(undefined);
      expect(node.delimiterWhitespaceStart).toBe(undefined);
      expect(node.delimiterWhitespaceEnd).toBe(undefined);
      expect(node.whitespaceStart).toBe('');
      expect(node.whitespaceEnd).toBe('');
      expect(node.blockStartPosition).toEqual(envelope.blockStartPosition);
      expect(node.source).toBe(source);
      expect(source.slice(node.position.start, node.position.end)).toBe('{% unknown_tag %}');
    });

    it('creates block base-case with children and end position', () => {
      const source = PAD + '{% custom %}hello{% endcustom %}';
      const tokens = tokenize(source);
      const tagOpens = findTokens(tokens, TokenType.LiquidTagOpen);
      const tagCloses = findTokens(tokens, TokenType.LiquidTagClose);

      // Opening tag: first open/close pair
      const openTagOpen = tagOpens[0];
      const openTagClose = tagCloses[0];
      const envelope = envelopeFromTokens(openTagOpen, openTagClose, source);

      // End tag: second open/close pair
      const endTagOpen = tagOpens[1];
      const endTagClose = tagCloses[1];
      const blockEndPosition = { start: endTagOpen.start, end: endTagClose.end };

      // Body text node
      const helloStart = openTagClose.end;
      const helloEnd = endTagOpen.start;
      const textNode = makeTextNode('hello', helloStart, helloEnd, source);

      const node = makeLiquidTagBaseCase(envelope, [textNode], blockEndPosition, {
        start: '',
        end: '',
      });

      expect(node.type).toBe(NodeTypes.LiquidTag);
      expect(node.name).toBe('custom');
      expect(node.children).toBeDefined();
      expect(node.children!.length).toBe(1);
      expect(node.blockEndPosition).toEqual(blockEndPosition);
      expect(node.delimiterWhitespaceStart).toBe('');
      expect(node.delimiterWhitespaceEnd).toBe('');
      expect(node.source).toBe(source);
      expect(source.slice(node.position.start, node.position.end)).toBe(
        '{% custom %}hello{% endcustom %}',
      );
    });

    it('carries whitespace fields from envelope', () => {
      const source = PAD + '{%- custom -%}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const node = makeLiquidTagBaseCase(envelope);

      expect(node.whitespaceStart).toBe('-');
      expect(node.whitespaceEnd).toBe('-');
    });

    it('includes reason when provided', () => {
      const source = PAD + '{% unknown_tag %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const node = makeLiquidTagBaseCase(
        envelope,
        undefined,
        undefined,
        undefined,
        'some parse error',
      );

      expect(node.reason).toBe('some parse error');
    });

    it('omits reason when not provided', () => {
      const source = PAD + '{% unknown_tag %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const node = makeLiquidTagBaseCase(envelope);

      expect(node.reason).toBe(undefined);
    });
  });

  describe('makeLiquidTagNamed', () => {
    it('creates standalone named tag', () => {
      const source = PAD + '{% echo product %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const mockMarkup = {
        type: NodeTypes.LiquidVariable,
        position: { start: OFFSET + 8, end: OFFSET + 15 },
        source,
      };
      const node = makeLiquidTagNamed(envelope, mockMarkup);

      expect(node.type).toBe(NodeTypes.LiquidTag);
      expect(node.name).toBe(NamedTags.echo);
      expect(node.markup).toBe(mockMarkup);
      expect(node.children).toBe(undefined);
      expect(node.blockEndPosition).toBe(undefined);
      expect(node.source).toBe(source);
      expect(source.slice(node.position.start, node.position.end)).toBe('{% echo product %}');
    });

    it('creates block named tag with children', () => {
      const source = PAD + '{% if cond %}body{% endif %}';
      const tokens = tokenize(source);
      const tagOpens = findTokens(tokens, TokenType.LiquidTagOpen);
      const tagCloses = findTokens(tokens, TokenType.LiquidTagClose);

      const openTagOpen = tagOpens[0];
      const openTagClose = tagCloses[0];
      const envelope = envelopeFromTokens(openTagOpen, openTagClose, source);

      const endTagOpen = tagOpens[1];
      const endTagClose = tagCloses[1];
      const blockEndPosition = { start: endTagOpen.start, end: endTagClose.end };

      const bodyStart = openTagClose.end;
      const bodyEnd = endTagOpen.start;
      const textNode = makeTextNode('body', bodyStart, bodyEnd, source);

      const mockMarkup = {
        type: NodeTypes.VariableLookup,
        name: 'cond',
        lookups: [],
        position: { start: OFFSET + 6, end: OFFSET + 10 },
        source,
      };

      const node = makeLiquidTagNamed(envelope, mockMarkup, [textNode], blockEndPosition, {
        start: '',
        end: '',
      });

      expect(node.type).toBe(NodeTypes.LiquidTag);
      expect(node.name).toBe(NamedTags.if);
      expect(node.children).toBeDefined();
      expect(node.children!.length).toBe(1);
      expect(node.blockEndPosition).toEqual(blockEndPosition);
      expect(node.source).toBe(source);
      expect(source.slice(node.position.start, node.position.end)).toBe(
        '{% if cond %}body{% endif %}',
      );
    });
  });

  describe('makeLiquidBranchUnnamed', () => {
    it('creates unnamed branch', () => {
      const source = PAD + '{% if cond %}body{% endif %}';
      const node = makeLiquidBranchUnnamed(17, source);

      expect(node.type).toBe(NodeTypes.LiquidBranch);
      expect(node.name).toBe(null);
      expect(node.markup).toBe('');
      expect(node.children).toEqual([]);
      expect(node.whitespaceStart).toBe('');
      expect(node.whitespaceEnd).toBe('');
      expect(node.source).toBe(source);
      expect(node.blockStartPosition.start).toBe(17);
      expect(node.blockStartPosition.end).toBe(17);
      // blockEndPosition is required by LiquidBranchNode — verify it exists
      expect(node.blockEndPosition).toBeDefined();
    });
  });

  describe('makeLiquidBranchNamed', () => {
    it('creates elsif branch', () => {
      const source = PAD + '{% elsif cond2 %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const mockMarkup = {
        type: NodeTypes.VariableLookup,
        name: 'cond2',
        lookups: [],
        position: { start: OFFSET + 10, end: OFFSET + 15 },
        source,
      };
      const node = makeLiquidBranchNamed(envelope, mockMarkup);

      expect(node.type).toBe(NodeTypes.LiquidBranch);
      expect(node.name).toBe(NamedTags.elsif);
      expect(node.markup).toBe(mockMarkup);
      expect(node.children).toEqual([]);
      expect(node.source).toBe(source);
      const bsp = node.blockStartPosition;
      expect(source.slice(bsp.start, bsp.end)).toBe('{% elsif cond2 %}');
      expect(node.whitespaceStart).toBe('');
      expect(node.whitespaceEnd).toBe('');
    });

    it('creates else branch', () => {
      const source = PAD + '{% else %}';
      const tokens = tokenize(source);
      const open = findToken(tokens, TokenType.LiquidTagOpen);
      const close = findToken(tokens, TokenType.LiquidTagClose);
      const envelope = envelopeFromTokens(open, close, source);
      const node = makeLiquidBranchNamed(envelope, '');

      expect(node.type).toBe(NodeTypes.LiquidBranch);
      expect(node.name).toBe('else');
      expect(node.markup).toBe('');
      expect(node.source).toBe(source);
      expect(source.slice(node.blockStartPosition.start, node.blockStartPosition.end)).toBe(
        '{% else %}',
      );
    });
  });

  describe('makeLiquidRawTag', () => {
    it('creates raw tag', () => {
      const source = PAD + '{% raw %}content{% endraw %}';
      const tokens = tokenize(source);
      const tagOpens = findTokens(tokens, TokenType.LiquidTagOpen);
      const tagCloses = findTokens(tokens, TokenType.LiquidTagClose);

      const openTagOpen = tagOpens[0];
      const openTagClose = tagCloses[0];
      const envelope = envelopeFromTokens(openTagOpen, openTagClose, source);

      const endTagOpen = tagOpens[1];
      const endTagClose = tagCloses[1];
      const blockEndPosition = { start: endTagOpen.start, end: endTagClose.end };

      const bodyStart = openTagClose.end;
      const bodyEnd = endTagOpen.start;
      const bodyValue = source.slice(bodyStart, bodyEnd);
      const body = makeRawMarkup(RawMarkupKinds.text, bodyValue, [], bodyStart, bodyEnd, source);

      const node = makeLiquidRawTag(envelope, body, blockEndPosition, { start: '', end: '' });

      expect(node.type).toBe(NodeTypes.LiquidRawTag);
      expect(node.name).toBe(RawTags.raw);
      expect(node.body).toBe(body);
      expect(node.markup).toBe('');
      expect(node.whitespaceStart).toBe('');
      expect(node.whitespaceEnd).toBe('');
      expect(node.delimiterWhitespaceStart).toBe('');
      expect(node.delimiterWhitespaceEnd).toBe('');
      expect(node.source).toBe(source);
      expect(source.slice(node.position.start, node.position.end)).toBe(
        '{% raw %}content{% endraw %}',
      );
    });

    it('handles whitespace on raw tag', () => {
      const source = PAD + '{%- raw %}content{% endraw -%}';
      const tokens = tokenize(source);
      const tagOpens = findTokens(tokens, TokenType.LiquidTagOpen);
      const tagCloses = findTokens(tokens, TokenType.LiquidTagClose);

      const openTagOpen = tagOpens[0];
      const openTagClose = tagCloses[0];
      const envelope = envelopeFromTokens(openTagOpen, openTagClose, source);

      const endTagOpen = tagOpens[1];
      const endTagClose = tagCloses[1];
      const blockEndPosition = { start: endTagOpen.start, end: endTagClose.end };

      const bodyStart = openTagClose.end;
      const bodyEnd = endTagOpen.start;
      const bodyValue = source.slice(bodyStart, bodyEnd);
      const body = makeRawMarkup(RawMarkupKinds.text, bodyValue, [], bodyStart, bodyEnd, source);

      const node = makeLiquidRawTag(envelope, body, blockEndPosition, { start: '', end: '-' });

      expect(node.whitespaceStart).toBe('-');
      expect(node.whitespaceEnd).toBe('');
      expect(node.delimiterWhitespaceStart).toBe('');
      expect(node.delimiterWhitespaceEnd).toBe('-');
      expect(source.slice(node.position.start, node.position.end)).toBe(
        '{%- raw %}content{% endraw -%}',
      );
    });
  });

  describe('makeDocumentNode', () => {
    it('creates DocumentNode with correct fields', () => {
      const source = PAD + '<div>hello</div>';
      const textChild = makeTextNode(source, 0, source.length, source);
      const node = makeDocumentNode([textChild], source);

      expect(node.type).toBe(NodeTypes.Document);
      expect(node.name).toBe('#document');
      expect(node.children.length).toBe(1);
      expect(node.children[0]).toBe(textChild);
      expect(node.position.start).toBe(0);
      expect(node.position.end).toBe(source.length);
      expect(source.slice(node.position.start, node.position.end)).toBe(source);
      expect(node.source).toBe(source);
      expect(node._source).toBe(source);
    });

    it('creates empty DocumentNode', () => {
      const source = '';
      const node = makeDocumentNode([], source);

      expect(node.type).toBe(NodeTypes.Document);
      expect(node.name).toBe('#document');
      expect(node.children).toEqual([]);
      expect(node.position.start).toBe(0);
      expect(node.position.end).toBe(0);
    });

    it('position spans the entire source', () => {
      const source = PAD + 'some content here';
      const node = makeDocumentNode([], source);

      expect(node.position.start).toBe(0);
      expect(node.position.end).toBe(source.length);
      expect(source.slice(node.position.start, node.position.end)).toBe(source);
    });
  });

  describe('makeYamlFrontmatter', () => {
    it('creates YAMLFrontmatter with correct fields', () => {
      const source = PAD + '---\ntitle: hello\n---\ncontent';
      const frontmatterStart = OFFSET;
      const frontmatterEnd = OFFSET + '---\ntitle: hello\n---'.length;
      const body = 'title: hello\n';
      const node = makeYamlFrontmatter(body, frontmatterStart, frontmatterEnd, source);

      expect(node.type).toBe(NodeTypes.YAMLFrontmatter);
      expect(node.body).toBe(body);
      expect(node.position.start).toBe(frontmatterStart);
      expect(node.position.end).toBe(frontmatterEnd);
      expect(source.slice(node.position.start, node.position.end)).toBe('---\ntitle: hello\n---');
      expect(node.source).toBe(source);
    });

    it('handles empty body', () => {
      const source = PAD + '---\n---\ncontent';
      const frontmatterStart = OFFSET;
      const frontmatterEnd = OFFSET + '---\n---'.length;
      const node = makeYamlFrontmatter('', frontmatterStart, frontmatterEnd, source);

      expect(node.type).toBe(NodeTypes.YAMLFrontmatter);
      expect(node.body).toBe('');
      expect(source.slice(node.position.start, node.position.end)).toBe('---\n---');
    });

    it('position slice matches source region at nonzero offset', () => {
      const source = PAD + '---\nkey: val\n---';
      const frontmatterStart = OFFSET;
      const frontmatterEnd = source.length;
      const node = makeYamlFrontmatter('key: val\n', frontmatterStart, frontmatterEnd, source);

      expect(node.position.start).toBe(OFFSET);
      expect(node.position.start).toBeGreaterThan(0);
      expect(source.slice(node.position.start, node.position.end)).toBe('---\nkey: val\n---');
    });
  });
});
