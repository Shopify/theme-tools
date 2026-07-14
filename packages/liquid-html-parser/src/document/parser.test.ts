import { describe, it } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import { expectPath, expectPosition } from './test-helpers';

describe('Unit: document-parser', () => {
  describe('empty document', () => {
    it('should return DocumentNode with empty children', () => {
      const ast = toLiquidHtmlAST('');
      expectPath(ast, 'type').to.eql('Document');
      expectPath(ast, 'name').to.eql('#document');
      expectPath(ast, 'children').to.have.lengthOf(0);
      expectPath(ast, 'position.start').to.eql(0);
      expectPath(ast, 'position.end').to.eql(0);
      expectPath(ast, 'source').to.eql('');
      expectPath(ast, '_source').to.eql('');
    });

    it('should work with toLiquidAST too', () => {
      const ast = toLiquidAST('');
      expectPath(ast, 'type').to.eql('Document');
      expectPath(ast, 'children').to.have.lengthOf(0);
    });
  });

  describe('plain text', () => {
    it('should parse plain text as a single TextNode', () => {
      const source = 'hello world';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('hello world');
      expectPosition(ast, 'children.0').to.eql('hello world');
    });

    it('should preserve whitespace and newlines', () => {
      const source = '  hello\n  world\n';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      // Leading/trailing whitespace is trimmed from document-root text nodes
      expectPath(ast, 'children.0.value').to.eql('hello\n  world');
    });

    it('should work with whitespace-only source', () => {
      const source = '   \n\t  ';
      const ast = toLiquidHtmlAST(source);
      // Whitespace-only text nodes are stripped from document root edges
      expectPath(ast, 'children').to.have.lengthOf(0);
    });
  });

  describe('YAML frontmatter', () => {
    it('should parse YAML frontmatter followed by text', () => {
      const source = '---\nkey: value\n---\nrest';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(2);
      expectPath(ast, 'children.0.type').to.eql('YAMLFrontmatter');
      expectPath(ast, 'children.0.body').to.eql('key: value\n');
      expectPosition(ast, 'children.0').to.eql('---\nkey: value\n---\n');
      expectPath(ast, 'children.1.type').to.eql('TextNode');
      expectPath(ast, 'children.1.value').to.eql('rest');
      expectPosition(ast, 'children.1').to.eql('rest');
    });

    it('should parse YAML frontmatter without trailing text', () => {
      const source = '---\nkey: value\n---';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('YAMLFrontmatter');
      expectPath(ast, 'children.0.body').to.eql('key: value\n');
    });

    it('should extract multi-line body correctly', () => {
      const source = '---\ntitle: hello\nauthor: world\n---\n';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.body').to.eql('title: hello\nauthor: world\n');
    });
  });

  describe('skeleton: non-HTML tokens become TextNode in Liquid mode', () => {
    it('should collapse HTML tokens into TextNode in toLiquidAST mode', () => {
      const source = '<div>hello</div>';
      const ast = toLiquidAST(source);
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<div>hello</div>');
    });

    it('should handle YAML frontmatter + Liquid drop', () => {
      const source = '---\nk: v\n---\n{{ x }}';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(2);
      expectPath(ast, 'children.0.type').to.eql('YAMLFrontmatter');
      expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
    });
  });

  describe('DocumentNode invariants', () => {
    const sources = ['', 'hello', '---\nk: v\n---\nrest', '{{ x }}', '<div>text</div>'];

    for (const source of sources) {
      it(`should have correct structure for: "${source.slice(0, 30)}"`, () => {
        const ast = toLiquidHtmlAST(source);
        expectPath(ast, 'type').to.eql('Document');
        expectPath(ast, 'name').to.eql('#document');
        expectPath(ast, 'source').to.eql(source);
        expectPath(ast, '_source').to.eql(source);
        expectPath(ast, 'position.start').to.eql(0);
        expectPath(ast, 'position.end').to.eql(source.length);
      });
    }
  });

  describe('parseHtml: false mode', () => {
    it('should collapse all HTML into text nodes', () => {
      const ast = toLiquidAST('<div class="a">text</div>');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<div class="a">text</div>');
    });

    it('should parse Liquid drops between HTML text', () => {
      const ast = toLiquidAST('<div>{{ x }}</div>');
      expectPath(ast, 'children').to.have.lengthOf(3);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<div>');
      expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.2.type').to.eql('TextNode');
      expectPath(ast, 'children.2.value').to.eql('</div>');
    });

    it('should collapse HTML comments into text', () => {
      const ast = toLiquidAST('<!-- comment -->');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<!-- comment -->');
    });

    it('should collapse DOCTYPE into text', () => {
      const ast = toLiquidAST('<!DOCTYPE html>');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<!DOCTYPE html>');
    });

    it('should collapse self-closing tags into text', () => {
      const ast = toLiquidAST('<img src="photo.jpg" />');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<img src="photo.jpg" />');
    });

    it('should handle HTML inside Liquid block bodies', () => {
      const ast = toLiquidAST('{% for item in items %}<li>{{ item }}</li>{% endfor %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('for');
      // branch children: TextNode(<li>) + LiquidVariableOutput + TextNode(</li>)
      expectPath(ast, 'children.0.children.0.children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.children.0.value').to.eql('<li>');
      expectPath(ast, 'children.0.children.0.children.1.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.children.0.children.2.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.children.2.value').to.eql('</li>');
    });

    it('should tolerate unclosed Liquid block tags at end-of-input', () => {
      const ast = toLiquidAST('{% for a in b %} <div> {% if true %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('for');
      // Inside for: TextNode + if tag
      expectPath(ast, 'children.0.children.0.children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.children.1.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.children.0.children.1.name').to.eql('if');
    });

    it('should tolerate unclosed Liquid tags in {% liquid %} blocks', () => {
      const ast = toLiquidAST(`{%- liquid
  assign var1 = product
  if use_variant
    assign var2 = var1
-%}`);
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('liquid');
      // Verify inner structure is properly parsed (not base case fallback)
      expectPath(ast, 'children.0.markup.0.name').to.eql('assign');
      expectPath(ast, 'children.0.markup.1.name').to.eql('if');
    });

    it('should parse raw Liquid tags normally (doc, comment, raw)', () => {
      const ast = toLiquidAST('{% doc %}@param x{% enddoc %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
      expectPath(ast, 'children.0.name').to.eql('doc');
    });

    it('should handle script/style tags with Liquid as text nodes', () => {
      const source = '<script>\n  const a = {{ product | json }};\n</script>';
      const ast = toLiquidAST(source);
      // First child is text up to the Liquid drop (trailing space trimmed at non-text boundary)
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.value').to.eql('<script>\n  const a =');
      // The drop itself
      expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
      // Remaining text including </script>
      expectPath(ast, 'children.2.type').to.eql('TextNode');
      expectPath(ast, 'children.2.value').to.eql(';\n</script>');
    });

    it('should maintain position accuracy for merged text nodes', () => {
      const source = '  <div class="x">hello</div>  ';
      const ast = toLiquidAST(source);
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('TextNode');
      // In non-HTML mode, leading/trailing whitespace is trimmed from text at document root
      expectPosition(ast, 'children.0').to.eql('<div class="x">hello</div>');
    });

    it('should parse YAML frontmatter normally', () => {
      const ast = toLiquidAST('---\ntitle: test\n---\n<div>{{ x }}</div>');
      expectPath(ast, 'children.0.type').to.eql('YAMLFrontmatter');
      expectPath(ast, 'children.1.type').to.eql('TextNode');
      expectPath(ast, 'children.2.type').to.eql('LiquidVariableOutput');
    });
  });
});
