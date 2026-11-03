import { expect, it, describe } from 'vitest';
import { toLiquidHtmlAST } from './ast';
import type { LiquidHtmlNode } from './ast';
import { deepGet } from './utils';

describe('Unit: Stage 2 (AST)', () => {
  let ast: any;

  describe('toLiquidHTML(test, mode: completion)', () => {
    const toAST = (source: string) =>
      toLiquidHtmlAST(source, { mode: 'completion', allowUnclosedDocumentNode: true });
    const expectPath = makeExpectPath('toLiquidHTML(test, mode: completion)');

    it.skip('should not freak out when parsing dangling closing nodes outside of the normally accepted context', () => {
      ast = toAST(`<h1></h█>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.children.0.type').to.equal('HtmlDanglingMarkerClose');
      expectPath(ast, 'children.0.children.0.name.0.value').to.equal('h█');
    });

    it('should not freak out when parsing dangling open node outside of the normally accepted context', () => {
      ast = toAST(`<h█>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.name.0.value').to.equal('h█');
    });

    it.skip('should not freak out when parsing incomplete named arguments for content_for tags', () => {
      ast = toAST(`{% content_for "blocks", id: 1, cl█ %}`);

      expectPath(ast, 'children.0.type').to.equal('LiquidTag');
      expectPath(ast, 'children.0.markup.args.0.type').to.equal('NamedArgument');
      expectPath(ast, 'children.0.markup.args.1.type').to.equal('VariableLookup');
      expectPath(ast, 'children.0.markup.args').to.have.lengthOf(2);
    });

    it.skip('should not freak out when parsing dangling liquid tags', () => {
      ast = toAST(`<h {% if cond %}attr{% end█ %}>`);
      expectPath(ast, 'children.0.type').to.equal('HtmlElement');
      expectPath(ast, 'children.0.attributes.0.type').to.equal('LiquidTag');
      expectPath(ast, 'children.0.attributes.0.children.0.type').to.equal('LiquidBranch');
      expectPath(ast, 'children.0.attributes.0.children.0.children.1.type').to.equal('LiquidTag');
    });

    it.skip('should not freak out when completing doc tags', () => {
      ast = toAST(`
        {% doc %}
        @description This is a description
        @example This is an example
        @param {String} paramWithDescription - param with description
        @p█
      `);
      expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocDescriptionNode');
      expectPath(ast, 'children.0.body.nodes.0.content.value').to.eql('This is a description');

      expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidDocExampleNode');
      expectPath(ast, 'children.0.body.nodes.1.name').to.eql('example');
      expectPath(ast, 'children.0.body.nodes.1.content.value').to.eql('This is an example');

      expectPath(ast, 'children.0.body.nodes.2.type').to.eql('LiquidDocParamNode');
      expectPath(ast, 'children.0.body.nodes.2.name').to.eql('param');
      expectPath(ast, 'children.0.body.nodes.2.paramName.value').to.eql('paramWithDescription');

      expectPath(ast, 'children.0.body.nodes.3.type').to.eql('TextNode');
      expectPath(ast, 'children.0.body.nodes.3.value').to.eql('@p█');
    });
  });

  function makeExpectPath(message: string) {
    return function expectPath(ast: LiquidHtmlNode, path: string) {
      return expect(deepGet(path.split('.'), ast), message);
    };
  }
});
