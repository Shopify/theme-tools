import { describe, it } from 'vitest';
import { toLiquidHtmlAST } from '../ast';
import { expectPath, expectPosition, expectBlockEndPosition } from './test-helpers';

describe('Unit: liquid-lines', () => {
  it('should parse an empty liquid tag', () => {
    const ast = toLiquidHtmlAST('{% liquid %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('liquid');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(0);
  });

  it('should parse a single echo statement', () => {
    const ast = toLiquidHtmlAST('{% liquid\necho "hi"\n%}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('liquid');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.markup.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.0.markup.type').to.eql('LiquidVariable');
  });

  it('should parse multiple statements', () => {
    const ast = toLiquidHtmlAST('{% liquid\nassign x = 1\necho x\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(2);
    expectPath(ast, 'children.0.markup.0.name').to.eql('assign');
    expectPath(ast, 'children.0.markup.1.name').to.eql('echo');
  });

  it('should parse a block tag (if/endif)', () => {
    const ast = toLiquidHtmlAST('{% liquid\nif true\necho "yes"\nendif\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.markup.0.name').to.eql('if');
    // if has branches; first (unnamed) branch has echo child
    expectPath(ast, 'children.0.markup.0.children').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.children.0.type').to.eql('LiquidBranch');
    expectPath(ast, 'children.0.markup.0.children.0.name').to.eql(null);
    expectPath(ast, 'children.0.markup.0.children.0.children').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.children.0.children.0.name').to.eql('echo');
  });

  it('should parse branched block (if/elsif/else)', () => {
    const ast = toLiquidHtmlAST(
      '{% liquid\nif a\necho "1"\nelsif b\necho "2"\nelse\necho "3"\nendif\n%}',
    );
    expectPath(ast, 'children.0.markup.0.name').to.eql('if');
    expectPath(ast, 'children.0.markup.0.children').to.have.lengthOf(3);
    expectPath(ast, 'children.0.markup.0.children.0.name').to.eql(null);
    expectPath(ast, 'children.0.markup.0.children.0.children.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.0.children.1.name').to.eql('elsif');
    expectPath(ast, 'children.0.markup.0.children.1.children.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.0.children.2.name').to.eql('else');
    expectPath(ast, 'children.0.markup.0.children.2.children.0.name').to.eql('echo');
  });

  it('should parse case/when', () => {
    const ast = toLiquidHtmlAST(
      '{% liquid\ncase x\nwhen 1\necho "one"\nwhen 2\necho "two"\nendcase\n%}',
    );
    expectPath(ast, 'children.0.markup.0.name').to.eql('case');
    expectPath(ast, 'children.0.markup.0.children').to.have.lengthOf(3);
    // First branch is unnamed (before first when)
    expectPath(ast, 'children.0.markup.0.children.0.name').to.eql(null);
    expectPath(ast, 'children.0.markup.0.children.1.name').to.eql('when');
    expectPath(ast, 'children.0.markup.0.children.1.children.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.0.children.2.name').to.eql('when');
    expectPath(ast, 'children.0.markup.0.children.2.children.0.name').to.eql('echo');
  });

  it('should parse for/else', () => {
    const ast = toLiquidHtmlAST(
      '{% liquid\nfor item in items\necho item\nelse\necho "empty"\nendfor\n%}',
    );
    expectPath(ast, 'children.0.markup.0.name').to.eql('for');
    expectPath(ast, 'children.0.markup.0.children').to.have.lengthOf(2);
    expectPath(ast, 'children.0.markup.0.children.0.name').to.eql(null);
    expectPath(ast, 'children.0.markup.0.children.0.children.0.name').to.eql('echo');
    expectPath(ast, 'children.0.markup.0.children.1.name').to.eql('else');
    expectPath(ast, 'children.0.markup.0.children.1.children.0.name').to.eql('echo');
  });

  it('should parse raw tag (comment)', () => {
    const ast = toLiquidHtmlAST('{% liquid\ncomment\nthis is ignored\nendcomment\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.markup.0.name').to.eql('comment');
    expectPath(ast, 'children.0.markup.0.body.type').to.eql('RawMarkup');
    expectPath(ast, 'children.0.markup.0.body.value').to.eql('this is ignored\n');
  });

  it('should set RawMarkup start position to lineEnd, not lineEnd+1 (Bug 47 regression)', () => {
    // Source:  {% liquid\ncomment\nbody text\nendcomment\n%}
    // Offsets: 0         9 10     17 18       27 28       37 38 40
    //          ^{%liquid  ^comment  ^body text  ^endcomment  ^%}
    // lineEnd for 'comment' line = 17 (the \n after 'comment')
    // RawMarkup.position.start should be 17 (lineEnd), not 18 (lineEnd + 1)
    const source = '{% liquid\ncomment\nbody text\nendcomment\n%}';
    const ast = toLiquidHtmlAST(source);
    const body = 'children.0.markup.0.body';
    expectPath(ast, `${body}.type`).to.eql('RawMarkup');
    expectPath(ast, `${body}.position.start`).to.eql(17);
    expectPath(ast, `${body}.position.end`).to.eql(28);
    expectPath(ast, `${body}.value`).to.eql('body text\n');
  });

  it('should parse inline comment (#)', () => {
    const ast = toLiquidHtmlAST('{% liquid\n# a comment\necho "hi"\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(2);
    expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.markup.0.name').to.eql('#');
    expectPath(ast, 'children.0.markup.1.name').to.eql('echo');
  });

  it('should skip empty lines', () => {
    const ast = toLiquidHtmlAST('{% liquid\n\necho "hi"\n\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.name').to.eql('echo');
  });

  it('should parse unknown tag as base case', () => {
    const ast = toLiquidHtmlAST('{% liquid\nunknown_tag foo\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.markup.0.name').to.eql('unknown_tag');
    expectPath(ast, 'children.0.markup.0.markup').to.eql('foo');
  });

  it('should parse nested blocks', () => {
    const ast = toLiquidHtmlAST(
      '{% liquid\nfor item in items\nif item\necho item\nendif\nendfor\n%}',
    );
    expectPath(ast, 'children.0.markup.0.name').to.eql('for');
    // for has unnamed branch
    const forBranch = 'children.0.markup.0.children.0';
    expectPath(ast, `${forBranch}.children`).to.have.lengthOf(1);
    expectPath(ast, `${forBranch}.children.0.name`).to.eql('if');
    // if has unnamed branch with echo
    expectPath(ast, `${forBranch}.children.0.children.0.children.0.name`).to.eql('echo');
  });

  it('should have document-relative positions', () => {
    const source = '{% liquid\necho "hi"\n%}';
    const ast = toLiquidHtmlAST(source);
    // The liquid tag itself spans the whole thing
    expectPosition(ast, 'children.0').to.eql(source);
    // The echo statement inside: "echo" starts at offset 10 (after "{% liquid\n")
    expectPath(ast, 'children.0.markup.0.position.start').to.eql(10);
  });

  it('should fall back to base case for bad markup (tolerant)', () => {
    const ast = toLiquidHtmlAST('{% liquid\nassign !bad\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(1);
    expectPath(ast, 'children.0.markup.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.markup.0.name').to.eql('assign');
    // markup should be string (base case) not parsed AssignMarkup
    expectPath(ast, 'children.0.markup.0.markup').to.be.a('string');
  });

  it('should parse multiple blocks at same level', () => {
    const ast = toLiquidHtmlAST('{% liquid\nif a\necho "1"\nendif\nif b\necho "2"\nendif\n%}');
    expectPath(ast, 'children.0.markup').to.have.lengthOf(2);
    expectPath(ast, 'children.0.markup.0.name').to.eql('if');
    expectPath(ast, 'children.0.markup.1.name').to.eql('if');
  });

  describe('blockEndPosition spans end keyword (Bug 12)', () => {
    it('should have non-zero-width blockEndPosition for block tags (if/endif)', () => {
      const source = '{% liquid\nif true\necho "yes"\nendif\n%}';
      const ast = toLiquidHtmlAST(source);
      const ifTag = 'children.0.markup.0';
      expectPath(ast, `${ifTag}.name`).to.eql('if');
      expectBlockEndPosition(ast, ifTag).to.eql('endif');
    });

    it('should have non-zero-width blockEndPosition for nested blocks', () => {
      const source = '{% liquid\nfor item in items\nif item\necho item\nendif\nendfor\n%}';
      const ast = toLiquidHtmlAST(source);
      const forTag = 'children.0.markup.0';
      expectPath(ast, `${forTag}.name`).to.eql('for');
      expectBlockEndPosition(ast, forTag).to.eql('endfor');
      const ifTag = `${forTag}.children.0.children.0`;
      expectPath(ast, `${ifTag}.name`).to.eql('if');
      expectBlockEndPosition(ast, ifTag).to.eql('endif');
    });

    it('should have non-zero-width blockEndPosition for branched blocks', () => {
      const source = '{% liquid\nif a\necho "1"\nelsif b\necho "2"\nelse\necho "3"\nendif\n%}';
      const ast = toLiquidHtmlAST(source);
      const ifTag = 'children.0.markup.0';
      expectPath(ast, `${ifTag}.name`).to.eql('if');
      expectBlockEndPosition(ast, ifTag).to.eql('endif');
    });

    it('should have non-zero-width blockEndPosition for case/endcase', () => {
      const source = '{% liquid\ncase x\nwhen 1\necho "one"\nendcase\n%}';
      const ast = toLiquidHtmlAST(source);
      const caseTag = 'children.0.markup.0';
      expectPath(ast, `${caseTag}.name`).to.eql('case');
      expectBlockEndPosition(ast, caseTag).to.eql('endcase');
    });

    it('should have non-zero-width blockEndPosition for raw tags (comment)', () => {
      const source = '{% liquid\ncomment\nignored\nendcomment\n%}';
      const ast = toLiquidHtmlAST(source);
      const commentTag = 'children.0.markup.0';
      expectPath(ast, `${commentTag}.name`).to.eql('comment');
      expectBlockEndPosition(ast, commentTag).to.eql('endcomment');
    });

    it('should have correct position.end for tags inside liquid blocks', () => {
      const source = '{% liquid\nif true\necho "yes"\nendif\n%}';
      const ast = toLiquidHtmlAST(source);
      const ifTag = 'children.0.markup.0';
      // position.end should equal blockEndPosition.end (both span through endif keyword)
      expectPosition(ast, ifTag).to.eql(source.slice(10, 10 + 'if true\necho "yes"\nendif'.length));
    });

    it('should have zero-width blockEndPosition on branches (not tags)', () => {
      const source = '{% liquid\nif true\necho "yes"\nendif\n%}';
      const ast = toLiquidHtmlAST(source);
      const branch = 'children.0.markup.0.children.0';
      expectPath(ast, `${branch}.type`).to.eql('LiquidBranch');
      // Branch blockEndPosition should be zero-width (start === end)
      expectPath(ast, `${branch}.blockEndPosition.start`).to.eql(source.indexOf('endif'));
      expectPath(ast, `${branch}.blockEndPosition.end`).to.eql(source.indexOf('endif'));
    });
  });
});
