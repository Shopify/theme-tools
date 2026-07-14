import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import {
  expectPath,
  expectPosition,
  expectBlockStartPosition,
  expectBlockEndPosition,
  sourceAt,
} from './test-helpers';

describe('Unit: liquid-blocks', () => {
  describe('branchless blocks (branches.length === 0)', () => {
    it('should parse {% capture x %}hello{% endcapture %}', () => {
      const ast = toLiquidHtmlAST('{% capture x %}hello{% endcapture %}');
      expectPath(ast, 'children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('capture');
      expectPath(ast, 'children.0.markup.type').to.eql('VariableLookup');
      expectPath(ast, 'children.0.markup.name').to.eql('x');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.value').to.eql('hello');
    });

    it('should parse {% ifchanged %}content{% endifchanged %}', () => {
      const ast = toLiquidHtmlAST('{% ifchanged %}content{% endifchanged %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('ifchanged');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.value').to.eql('content');
    });

    it('should parse empty branchless block', () => {
      const ast = toLiquidHtmlAST('{% capture x %}{% endcapture %}');
      expectPath(ast, 'children.0.name').to.eql('capture');
      expectPath(ast, 'children.0.children').to.have.lengthOf(0);
    });

    it('should parse block tag with Liquid children', () => {
      const ast = toLiquidHtmlAST('{% capture x %}{{ y }}{% endcapture %}');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.type').to.eql('LiquidVariableOutput');
    });

    it('should have correct positions for branchless block', () => {
      const source = '{% capture x %}hello{% endcapture %}';
      const ast = toLiquidHtmlAST(source);
      expectPosition(ast, 'children.0').to.eql(source);
      expectPosition(ast, 'children.0.children.0').to.eql('hello');
    });

    it('should set blockStartPosition for branchless block', () => {
      const source = '{% capture x %}hello{% endcapture %}';
      const ast = toLiquidHtmlAST(source);
      expectBlockStartPosition(ast, 'children.0').to.eql('{% capture x %}');
    });

    it('should set blockEndPosition for branchless block', () => {
      const source = '{% capture x %}hello{% endcapture %}';
      const ast = toLiquidHtmlAST(source);
      expectBlockEndPosition(ast, 'children.0').to.eql('{% endcapture %}');
    });

    it('should set delimiterWhitespace for end tag', () => {
      const source = '{% capture x %}hello{%- endcapture -%}';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('-');
      expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
    });

    it('should have undefined delimiterWhitespace when no stripping', () => {
      const source = '{% capture x %}hello{% endcapture %}';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('');
      expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('');
    });

    it('should fall back to base case for invalid markup (tolerant)', () => {
      const ast = toLiquidHtmlAST('{% capture x y z %}hello{% endcapture %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('capture');
      expectPath(ast, 'children.0.markup').to.eql('x y z');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
    });

    it('should parse HTML elements inside block children', () => {
      const source = '{% capture x %}<div>hello</div>{% endcapture %}';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.type').to.eql('HtmlElement');
      expectPath(ast, 'children.0.children.0.name.0.value').to.eql('div');
    });
  });

  describe('branched blocks (branches.length > 0)', () => {
    it('should wrap children in LiquidBranch for {% if %}', () => {
      const ast = toLiquidHtmlAST('{% if true %}hello{% endif %}');
      expectPath(ast, 'children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.name').to.eql('if');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
      expectPath(ast, 'children.0.children.0.name').to.eql(null);
      expectPath(ast, 'children.0.children.0.markup').to.eql('');
      expectPath(ast, 'children.0.children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.children.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.children.0.children.0.value').to.eql('hello');
    });

    it('should parse {% if %}...{% else %}...{% endif %}', () => {
      const ast = toLiquidHtmlAST('{% if true %}a{% else %}b{% endif %}');
      expectPath(ast, 'children.0.children').to.have.lengthOf(2);
      // First branch (unnamed)
      expectPath(ast, 'children.0.children.0.type').to.eql('LiquidBranch');
      expectPath(ast, 'children.0.children.0.name').to.eql(null);
      expectPath(ast, 'children.0.children.0.children.0.value').to.eql('a');
      // Second branch (else)
      expectPath(ast, 'children.0.children.1.type').to.eql('LiquidBranch');
      expectPath(ast, 'children.0.children.1.name').to.eql('else');
      expectPath(ast, 'children.0.children.1.markup').to.eql('');
      expectPath(ast, 'children.0.children.1.children.0.value').to.eql('b');
    });

    it('should parse {% if %}...{% elsif %}...{% else %}...{% endif %}', () => {
      const ast = toLiquidHtmlAST('{% if a %}1{% elsif b %}2{% else %}3{% endif %}');
      expectPath(ast, 'children.0.children').to.have.lengthOf(3);
      // Unnamed branch
      expectPath(ast, 'children.0.children.0.name').to.eql(null);
      expectPath(ast, 'children.0.children.0.children.0.value').to.eql('1');
      // elsif branch — parsed markup (conditionalExpression returns VariableLookup for simple var)
      expectPath(ast, 'children.0.children.1.name').to.eql('elsif');
      expectPath(ast, 'children.0.children.1.markup.type').to.eql('VariableLookup');
      expectPath(ast, 'children.0.children.1.children.0.value').to.eql('2');
      // else branch
      expectPath(ast, 'children.0.children.2.name').to.eql('else');
      expectPath(ast, 'children.0.children.2.markup').to.eql('');
      expectPath(ast, 'children.0.children.2.children.0.value').to.eql('3');
    });

    it('should parse {% case %}...{% when %}...{% else %}...{% endcase %}', () => {
      const ast = toLiquidHtmlAST(
        '{% case x %}{% when 1 %}one{% when 2 %}two{% else %}other{% endcase %}',
      );
      expectPath(ast, 'children.0.name').to.eql('case');
      expectPath(ast, 'children.0.children').to.have.lengthOf(4);
      // Unnamed (empty)
      expectPath(ast, 'children.0.children.0.name').to.eql(null);
      expectPath(ast, 'children.0.children.0.children').to.have.lengthOf(0);
      // when 1
      expectPath(ast, 'children.0.children.1.name').to.eql('when');
      expectPath(ast, 'children.0.children.1.children.0.value').to.eql('one');
      // when 2
      expectPath(ast, 'children.0.children.2.name').to.eql('when');
      expectPath(ast, 'children.0.children.2.children.0.value').to.eql('two');
      // else
      expectPath(ast, 'children.0.children.3.name').to.eql('else');
      expectPath(ast, 'children.0.children.3.children.0.value').to.eql('other');
    });

    it('should parse {% for %}...{% else %}...{% endfor %}', () => {
      const ast = toLiquidHtmlAST('{% for item in items %}{{ item }}{% else %}empty{% endfor %}');
      expectPath(ast, 'children.0.name').to.eql('for');
      expectPath(ast, 'children.0.markup.type').to.eql('ForMarkup');
      expectPath(ast, 'children.0.children').to.have.lengthOf(2);
      // Unnamed branch
      expectPath(ast, 'children.0.children.0.name').to.eql(null);
      expectPath(ast, 'children.0.children.0.children.0.type').to.eql('LiquidVariableOutput');
      // else branch
      expectPath(ast, 'children.0.children.1.name').to.eql('else');
      expectPath(ast, 'children.0.children.1.children.0.value').to.eql('empty');
    });

    it('should parse empty branched block', () => {
      const ast = toLiquidHtmlAST('{% if true %}{% endif %}');
      expectPath(ast, 'children.0.children').to.have.lengthOf(1);
      expectPath(ast, 'children.0.children.0.name').to.eql(null);
      expectPath(ast, 'children.0.children.0.children').to.have.lengthOf(0);
    });

    it('should parse {% when %} with multiple values', () => {
      const ast = toLiquidHtmlAST('{% case x %}{% when 1, 2 %}matched{% endcase %}');
      expectPath(ast, 'children.0.children.1.name').to.eql('when');
      // markup is an array of expressions
      expectPath(ast, 'children.0.children.1.markup').to.have.lengthOf(2);
    });

    it('should expose branch markup positions', () => {
      const source = '{% case x %}{% when 1, 2 %}matched{% else %}other{% endcase %}';
      const ast = toLiquidHtmlAST(source);
      const block = ast.children[0] as any;
      const unnamed = block.children[0];
      const when = block.children[1];
      const elseBranch = block.children[2];

      expect(sourceAt(source, unnamed.markupPosition)).to.eql('');
      expect(sourceAt(source, when.markupPosition)).to.eql('1, 2 ');
      expect(sourceAt(source, elseBranch.markupPosition)).to.eql('');
    });

    it('should expose branch markup positions with whitespace-control delimiters', () => {
      const source = '{% if a %}A{%- elsif   b -%}B{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const block = ast.children[0] as any;
      const branch = block.children[1];

      expect(sourceAt(source, branch.markupPosition)).to.eql('b ');
    });
  });

  describe('nested blocks', () => {
    it('should parse nested block tags', () => {
      const ast = toLiquidHtmlAST(
        '{% if a %}{% for item in items %}{{ item }}{% endfor %}{% endif %}',
      );
      expectPath(ast, 'children.0.name').to.eql('if');
      expectPath(ast, 'children.0.children.0.children.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.children.0.children.0.name').to.eql('for');
      expectPath(ast, 'children.0.children.0.children.0.children.0.children.0.type').to.eql(
        'LiquidVariableOutput',
      );
    });

    it('should parse nested branchless in branched', () => {
      const ast = toLiquidHtmlAST('{% if true %}{% capture x %}hello{% endcapture %}{% endif %}');
      expectPath(ast, 'children.0.children.0.children.0.name').to.eql('capture');
      expectPath(ast, 'children.0.children.0.children.0.children.0.value').to.eql('hello');
    });
  });

  describe('positions', () => {
    it('should have correct position for branched block tag', () => {
      const source = '{% if true %}hello{% endif %}';
      const ast = toLiquidHtmlAST(source);
      expectPosition(ast, 'children.0').to.eql(source);
    });

    it('should set blockEndPosition for branched block', () => {
      const source = '{% if true %}hello{% endif %}';
      const ast = toLiquidHtmlAST(source);
      expectBlockEndPosition(ast, 'children.0').to.eql('{% endif %}');
    });

    it('should set unnamed branch positions correctly', () => {
      const source = '{% if true %}hello{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const branch = (ast.children[0] as any).children[0];
      // blockStartPosition is zero-width at end of open tag
      expect(branch.blockStartPosition.start).to.eql(branch.blockStartPosition.end);
      expect(branch.blockStartPosition.start).to.eql('{% if true %}'.length);
      // blockEndPosition is zero-width at start of end tag
      expect(branch.blockEndPosition.start).to.eql(branch.blockEndPosition.end);
      expect(branch.blockEndPosition.start).to.eql('{% if true %}hello'.length);
    });

    it('should set named branch positions correctly', () => {
      const source = '{% if true %}a{% else %}b{% endif %}';
      const ast = toLiquidHtmlAST(source);
      // blockStartPosition spans the branch tag
      expectBlockStartPosition(ast, 'children.0.children.1').to.eql('{% else %}');
      // blockEndPosition is zero-width at start of end tag
      const elseBranch = (ast.children[0] as any).children[1];
      expect(elseBranch.blockEndPosition.start).to.eql(elseBranch.blockEndPosition.end);
    });

    it('should set position.end of branch to end of last child', () => {
      const source = '{% if true %}hello{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const branch = (ast.children[0] as any).children[0];
      // position.end should be end of 'hello' text node
      expect(branch.position.end).to.eql('{% if true %}hello'.length);
    });

    it('should set position of empty unnamed branch to bodyStart', () => {
      const source = '{% if true %}{% endif %}';
      const ast = toLiquidHtmlAST(source);
      const branch = (ast.children[0] as any).children[0];
      expect(branch.position.start).to.eql('{% if true %}'.length);
      expect(branch.position.end).to.eql('{% if true %}'.length);
    });
  });

  describe('whitespace stripping', () => {
    it('should handle whitespace stripping on open and end tags', () => {
      const ast = toLiquidHtmlAST('{%- if true -%}hello{%- endif -%}');
      expectPath(ast, 'children.0.whitespaceStart').to.eql('-');
      expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
      expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('-');
      expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
    });

    it('should handle whitespace stripping on branch tags', () => {
      const ast = toLiquidHtmlAST('{% if true %}a{%- else -%}b{% endif %}');
      expectPath(ast, 'children.0.children.1.whitespaceStart').to.eql('-');
      expectPath(ast, 'children.0.children.1.whitespaceEnd').to.eql('-');
    });
  });

  describe('error handling', () => {
    it('should throw for unclosed block tag', () => {
      expect(() => toLiquidHtmlAST('{% if true %}hello')).to.throw(/before.*if.*was closed/i);
    });

    it('should throw for orphaned end tag at top level', () => {
      expect(() => toLiquidHtmlAST('{% endif %}')).to.throw(
        /Attempting to close LiquidTag 'if' before it was opened/,
      );
    });

    it('should throw for orphaned endfor at top level', () => {
      expect(() => toLiquidHtmlAST('{% endfor %}')).to.throw(
        /Attempting to close LiquidTag 'for' before it was opened/,
      );
    });
  });

  describe('parity: toLiquidAST matches toLiquidHtmlAST', () => {
    it('should produce same structure for branchless block', () => {
      const source = '{% capture x %}hello{% endcapture %}';
      const htmlAst = toLiquidHtmlAST(source);
      const liquidAst = toLiquidAST(source);
      expectPath(htmlAst, 'children.0.name').to.eql('capture');
      expectPath(liquidAst, 'children.0.name').to.eql('capture');
      expectPath(htmlAst, 'children.0.children.0.value').to.eql('hello');
      expectPath(liquidAst, 'children.0.children.0.value').to.eql('hello');
    });

    it('should produce same structure for branched block', () => {
      const source = '{% if true %}a{% else %}b{% endif %}';
      const htmlAst = toLiquidHtmlAST(source);
      const liquidAst = toLiquidAST(source);
      expectPath(htmlAst, 'children.0.children').to.have.lengthOf(2);
      expectPath(liquidAst, 'children.0.children').to.have.lengthOf(2);
      expectPath(htmlAst, 'children.0.children.1.name').to.eql('else');
      expectPath(liquidAst, 'children.0.children.1.name').to.eql('else');
    });
  });

  describe('branchless blocks in HTML attribute context', () => {
    it('should produce AttrEmpty for bare text inside capture in attribute position', () => {
      const source = '<img {%- capture x %}{{ y }}%{%- endcapture -%}>';
      const ast = toLiquidHtmlAST(source);
      expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
      expectPath(ast, 'children.0.attributes.0.type').to.eql('LiquidTag');
      expectPath(ast, 'children.0.attributes.0.name').to.eql('capture');
      expectPath(ast, 'children.0.attributes.0.children.0.type').to.eql('LiquidVariableOutput');
      expectPath(ast, 'children.0.attributes.0.children.1.type').to.eql('AttrEmpty');
      expectPath(ast, 'children.0.attributes.0.children.1.name.0.value').to.eql('%');
    });
  });

  describe('malformed block bodies terminate instead of looping forever', () => {
    // Regression: an orphan `{% end* %}` naming a branch keyword (e.g. `endwhen`)
    // inside a block parsed in attribute context used to deadlock — the block
    // loop wouldn't consume it and the attribute parser treated it as a
    // terminator, so neither advanced the cursor. It must now throw cleanly.
    it('should throw (not hang) on an orphan endwhen inside a case in attribute position', () => {
      expect(() =>
        toLiquidHtmlAST(`<li {% case x %}{% when 'a' %} data-a{% endwhen %}{% endcase %}>z</li>`),
      ).to.throw(/Unexpected Liquid tag 'endwhen'/);
    });

    it('should throw (not hang) on an orphan end tag inside a branchless block', () => {
      expect(() =>
        toLiquidHtmlAST(`<li {% capture y %}{% endwhen %}{% endcapture %}>z</li>`),
      ).to.throw(/Unexpected Liquid tag 'endwhen'/);
    });

    it('tolerant mode (toLiquidAST) still degrades without looping', () => {
      expect(() =>
        toLiquidAST(`<li {% case x %}{% when 'a' %} data-a{% endwhen %}{% endcase %}>z</li>`),
      ).not.to.throw();
    });

    // Regression: the real tolerant path is HTML-mode (`toLiquidHtmlAST` with
    // allowUnclosedDocumentNode), used by liquid-render-tree's parse-html-fragment.
    // There the orphan `{% endwhen %}` is consumed as a degraded node so the loop reaches
    // the real `{% endcase %}` terminator — rather than leaking up to parseAttributeList,
    // where the sibling close tag would hit the unguarded throw in parseLiquidTag.
    it('tolerant HTML mode (toLiquidHtmlAST + allowUnclosedDocumentNode) degrades without throwing', () => {
      expect(() =>
        toLiquidHtmlAST(`<li {% case x %}{% when 'a' %} data-a{% endwhen %}{% endcase %}>z</li>`, {
          allowUnclosedDocumentNode: true,
          mode: 'tolerant',
        }),
      ).not.to.throw();
    });

    it('tolerant HTML mode degrades a branchless block with an orphan end tag without throwing', () => {
      expect(() =>
        toLiquidHtmlAST(`<li {% capture y %}{% endwhen %}{% endcapture %}>z</li>`, {
          allowUnclosedDocumentNode: true,
          mode: 'tolerant',
        }),
      ).not.to.throw();
    });
  });
});
