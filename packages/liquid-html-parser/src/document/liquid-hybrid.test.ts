import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import {
  expectPath,
  expectPosition,
  expectBlockStartPosition,
  expectBlockEndPosition,
} from './test-helpers';

describe('Unit: liquid-hybrid', () => {
  describe('standalone form', () => {
    it('should parse standalone section as LiquidTag with SectionMarkup', () => {
      const ast = toLiquidHtmlAST(`{% section 'foo' %}`);
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup.type').to.eql('SectionMarkup');
      expectPath(ast, 'children.0.markup.name.type').to.eql('String');
      expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
      expectPath(ast, 'children.0.markup.args').to.eql([]);
      expectPath(ast, 'children.0.children').to.be.undefined;
      expectPath(ast, 'children.0.blockEndPosition').to.be.undefined;
    });

    it('should parse standalone section with kwargs', () => {
      const ast = toLiquidHtmlAST(`{% section 'foo', key: 'val' %}`);
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
      expectPath(ast, 'children.0.markup.args.0.type').to.eql('NamedArgument');
      expectPath(ast, 'children.0.markup.args.0.name').to.eql('key');
      expectPath(ast, 'children.0.markup.args.0.value.value').to.eql('val');
      expectPath(ast, 'children.0.children').to.be.undefined;
    });

    it('should have correct position for standalone section', () => {
      const source = `{% section 'foo' %}`;
      const ast = toLiquidHtmlAST(source);
      expectPosition(ast, 'children.0').to.eql(source);
    });
  });

  describe('block form', () => {
    it('should parse block section with children', () => {
      const source = `{% section 'foo' %}content{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup.type').to.eql('SectionMarkup');
      expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.value').to.eql('content');
      expectBlockEndPosition(ast, 'children.0').to.eql('{% endsection %}');
    });

    it('should parse block section with kwargs', () => {
      const source = `{% section 'foo', key: 'val' %}content{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.markup.name.value').to.eql('foo');
      expectPath(ast, 'children.0.markup.args.0.name').to.eql('key');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.value').to.eql('content');
    });

    it('should parse empty block section', () => {
      const ast = toLiquidHtmlAST(`{% section 'foo' %}{% endsection %}`);
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.children').to.have.lengthOf(0);
    });

    it('should parse block section with Liquid children', () => {
      const ast = toLiquidHtmlAST(`{% section 'foo' %}{{ title }}{% echo "hi" %}{% endsection %}`);
      expectPath(ast, 'children.0.children').to.have.lengthOf(2);
      expectPath(ast, 'children.0.children.0.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.children.1.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.children.1.name').to.eql('echo');
    });

    it('should have correct position.end for block form', () => {
      const source = `{% section 'foo' %}content{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.position.end').to.eql(source.length);
    });

    it('should set blockEndPosition spanning endsection exactly', () => {
      const source = `{% section 'foo' %}content{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectBlockEndPosition(ast, 'children.0').to.eql('{% endsection %}');
    });

    it('should set blockStartPosition spanning open tag exactly', () => {
      const source = `{% section 'foo' %}content{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectBlockStartPosition(ast, 'children.0').to.eql(`{% section 'foo' %}`);
    });
  });

  describe('nesting-aware lookahead', () => {
    it('should parse nested sections: outer block, inner block', () => {
      const source = `{% section 'a' %}{% section 'b' %}{% endsection %}{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup.name.value').to.eql('a');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.children.0.name').to.eql('section');
      expectPath(ast, 'children.0.children.0.markup.name.value').to.eql('b');
      expectPath(ast, 'children.0.children.0.children').to.have.lengthOf(0);
    });

    it('should parse single endsection with nested section as siblings', () => {
      const source = `{% section 'outer' %}{% section 'inner' %}{% endsection %}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(2);
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup.name.value').to.eql('outer');
      expectPath(ast, 'children.0.children').to.be.undefined;
      expectPath(ast, 'children.1.name').to.eql('section');
      expectPath(ast, 'children.1.markup.name.value').to.eql('inner');
      expectPath(ast, 'children.1.children').to.have.lengthOf(0);
    });

    it('should parse two standalone sections', () => {
      const source = `{% section 'a' %}{% section 'b' %}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children').to.have.lengthOf(2);
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup.name.value').to.eql('a');
      expectPath(ast, 'children.0.children').to.be.undefined;
      expectPath(ast, 'children.1.name').to.eql('section');
      expectPath(ast, 'children.1.markup.name.value').to.eql('b');
      expectPath(ast, 'children.1.children').to.be.undefined;
    });
  });

  describe('whitespace stripping', () => {
    it('should capture symmetric whitespace trimming on endsection', () => {
      const source = `{% section 'foo' %}{%- endsection -%}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('-');
      expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
    });

    it('should capture asymmetric whitespace trimming on endsection', () => {
      const source = `{% section 'foo' %}{% endsection -%}`;
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('');
      expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
    });
  });

  describe('error handling', () => {
    it('should throw on orphaned endsection', () => {
      expect(() => toLiquidHtmlAST('{% endsection %}')).to.throw(
        /Attempting to close LiquidTag 'section' before it was opened/,
      );
    });

    it('should fall back to base case for bad markup in block form (tolerant)', () => {
      const ast = toLiquidHtmlAST('{% section !bad %}content{% endsection %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup').to.eql('!bad');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.value').to.eql('content');
    });

    it('should fall back to base case for bad markup in standalone form (tolerant)', () => {
      const ast = toLiquidHtmlAST('{% section !bad %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('section');
      expectPath(ast, 'children.0.markup').to.eql('!bad');
      expectPath(ast, 'children.0.children').to.be.undefined;
    });
  });

  describe('parity: toLiquidAST matches toLiquidHtmlAST', () => {
    it('should produce same structure for standalone section', () => {
      const source = `{% section 'foo' %}`;
      const htmlAst = toLiquidHtmlAST(source);
      const liquidAst = toLiquidAST(source);
      expectPath(htmlAst, 'children.0.name').to.eql('section');
      expectPath(liquidAst, 'children.0.name').to.eql('section');
      expectPath(htmlAst, 'children.0.markup.name.value').to.eql('foo');
      expectPath(liquidAst, 'children.0.markup.name.value').to.eql('foo');
      expectPath(htmlAst, 'children.0.children').to.be.undefined;
      expectPath(liquidAst, 'children.0.children').to.be.undefined;
    });

    it('should produce same structure for block section', () => {
      const source = `{% section 'foo' %}content{% endsection %}`;
      const htmlAst = toLiquidHtmlAST(source);
      const liquidAst = toLiquidAST(source);
      expectPath(htmlAst, 'children.0.name').to.eql('section');
      expectPath(liquidAst, 'children.0.name').to.eql('section');
      expectPath(htmlAst, 'children.0.children.0.value').to.eql('content');
      expectPath(liquidAst, 'children.0.children.0.value').to.eql('content');
    });
  });
});
