import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST } from '../ast';
import { deepGet } from '../utils';
import { expectPath, sourceAt } from './test-helpers';

describe('Unit: unclosed', () => {
  describe('conditional branches allow unclosed HTML (if/unless/case)', () => {
    it('should allow unclosed <div> inside if', () => {
      const source = '{% if cond %}<div>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
      const el = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlElement');
      // blockEndPosition slices to empty string (zero-width)
      expect(sourceAt(source, el.blockEndPosition)).to.eql('');
      // blockEndPosition is not -1 (>= blockStartPosition.end)
      expect(el.blockEndPosition.start).to.be.greaterThanOrEqual(el.blockStartPosition.end);
    });

    it('should allow unclosed <div> with text child inside if/else', () => {
      const source = '{% if cond %}<div>text{% else %}more{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const el = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlElement');
      expect(el.children).to.have.lengthOf(1);
      expect(el.children[0].value).to.eql('text');
      expect(sourceAt(source, el.blockEndPosition)).to.eql('');
      expect(el.blockEndPosition.start).to.be.greaterThan(el.blockStartPosition.end);
    });

    it('should allow unclosed <div> inside unless', () => {
      const source = '{% unless cond %}<div>{% endunless %}';
      const ast = toLiquidHtmlAST(source);
      const el = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlElement');
      expect(sourceAt(source, el.blockEndPosition)).to.eql('');
      expect(el.blockEndPosition.start).to.be.greaterThanOrEqual(el.blockStartPosition.end);
    });

    it('should allow unclosed <div> inside case/when', () => {
      const source = '{% case x %}{% when y %}<div>{% endcase %}';
      const ast = toLiquidHtmlAST(source);
      const el = deepGet('children.0.children.1.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlElement');
      expect(sourceAt(source, el.blockEndPosition)).to.eql('');
      expect(el.blockEndPosition.start).to.be.greaterThanOrEqual(el.blockStartPosition.end);
    });

    it('should allow 3 nested unclosed elements', () => {
      const source = '{% if cond %}<a><b><c>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const a = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(a.type).to.eql('HtmlElement');
      expect(a.name[0].value).to.eql('a');
      const b = a.children[0];
      expect(b.type).to.eql('HtmlElement');
      expect(b.name[0].value).to.eql('b');
      const c = b.children[0];
      expect(c.type).to.eql('HtmlElement');
      expect(c.name[0].value).to.eql('c');
    });

    it('should allow closed sibling before unclosed', () => {
      const source = '{% if cond %}<a>hi</a><b>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const branch = deepGet('children.0.children.0'.split('.'), ast) as any;
      expect(branch.children).to.have.lengthOf(2);
      expect(branch.children[0].type).to.eql('HtmlElement');
      expect(branch.children[0].name[0].value).to.eql('a');
      expect(branch.children[1].type).to.eql('HtmlElement');
      expect(branch.children[1].name[0].value).to.eql('b');
    });

    it('should allow unclosed parent with closed child', () => {
      const source = '{% if cond %}<b><a>hi</a>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const b = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(b.type).to.eql('HtmlElement');
      expect(b.name[0].value).to.eql('b');
      expect(b.children).to.have.lengthOf(1);
      expect(b.children[0].type).to.eql('HtmlElement');
      expect(b.children[0].name[0].value).to.eql('a');
    });
  });

  describe('non-conditional blocks throw on unclosed HTML', () => {
    const errorCases = [
      '{% for x in y %}<div>{% endfor %}',
      '{% tablerow x in y %}<div>{% endtablerow %}',
      '{% form "cart", cart %}<div>{% endform %}',
      '{% capture x %}<div>{% endcapture %}',
    ];

    for (const testCase of errorCases) {
      it(`should throw for: ${testCase}`, () => {
        expect(() => toLiquidHtmlAST(testCase)).to.throw(/Attempting to close/);
        try {
          toLiquidHtmlAST(testCase);
        } catch (e: any) {
          expect(e.name).to.eql('LiquidHTMLParsingError');
        }
      });
    }
  });

  describe('HtmlDanglingMarkerClose (orphaned close tags in conditional branches)', () => {
    it('should produce HtmlDanglingMarkerClose for </section> in if', () => {
      const source = '{% if cond %}</section>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const node = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(node.type).to.eql('HtmlDanglingMarkerClose');
      expect(node.name[0].value).to.eql('section');
    });

    it('should produce HtmlDanglingMarkerClose in both if/else branches', () => {
      const source = '{% if cond %}</div>{% else %}</main>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const node0 = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(node0.type).to.eql('HtmlDanglingMarkerClose');
      expect(node0.name[0].value).to.eql('div');
      const node1 = deepGet('children.0.children.1.children.0'.split('.'), ast) as any;
      expect(node1.type).to.eql('HtmlDanglingMarkerClose');
      expect(node1.name[0].value).to.eql('main');
    });
  });

  describe('document-level unclosed', () => {
    it('should throw for unclosed <div> at document level', () => {
      expect(() => toLiquidHtmlAST('<div>')).to.throw();
    });

    it('should throw for unclosed <p><div> at document level', () => {
      expect(() => toLiquidHtmlAST('<p><div>')).to.throw();
    });
  });

  describe('cross-node errors', () => {
    it('should throw for mismatched close tag <a><div></a>', () => {
      expect(() => toLiquidHtmlAST('<a><div></a>')).to.throw();
    });

    it('should throw for Liquid closing over unclosed HTML', () => {
      expect(() => toLiquidHtmlAST('{% for a in b %}<div>{% endfor %}')).to.throw(
        /Attempting to close/,
      );
    });

    it('should throw for unclosed form at branch boundary', () => {
      expect(() =>
        toLiquidHtmlAST('{% if cond %}{% form "cart" %}{% else %}{% endif %}'),
      ).to.throw();
    });
  });

  describe('dangling open tags with attributes in conditional branches', () => {
    it('should parse unclosed element with attributes', () => {
      const source = '{% if cond %}<div class="foo" id="bar">{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const el = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlElement');
      expect(el.attributes).to.have.lengthOf(2);
      expect(el.attributes[0].name[0].value).to.eql('class');
      expect(el.attributes[1].name[0].value).to.eql('id');
      expect(sourceAt(source, el.blockEndPosition)).to.eql('');
    });
  });

  describe('void elements should NOT be unclosed', () => {
    it('should parse <br> inside if as HtmlVoidElement', () => {
      const source = '{% if cond %}<br>{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const el = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlVoidElement');
      expect(el.name).to.eql('br');
    });

    it('should parse <img> with attribute inside if as HtmlVoidElement', () => {
      const source = '{% if cond %}<img src="x">{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const el = deepGet('children.0.children.0.children.0'.split('.'), ast) as any;
      expect(el.type).to.eql('HtmlVoidElement');
      expect(el.name).to.eql('img');
      expect(el.attributes).to.have.lengthOf(1);
    });
  });
});
