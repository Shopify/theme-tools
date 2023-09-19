import { describe, it, expect } from 'vitest';
import { LiquidHtmlNode } from '@shopify/theme-check-common';
import { CompletionParams, Position } from 'vscode-languageserver';
import { createLiquidCompletionParams } from './LiquidCompletionParams';
import { DocumentManager } from '../../documents';

describe('Module: LiquidCompletionParams', async () => {
  describe('createLiquidCompletionParams', async () => {
    describe('parsed LiquidHTML template', async () => {
      it('returns an undefined completionContext when the template is unsalvageable', () => {
        const context = '{{ }}%}%{%}%$}}{#$%}{% ren█ %}';
        const { completionContext } = createLiquidParamsFromContext(context);
        expect(completionContext).not.to.exist;
      });

      describe('completionContext.partialAst', async () => {
        it('returns an ast of the file up to the cursor position', async () => {
          const context = '{{ "hey" }}\n\n{{ product.id }}{% ren█ %}{% echo "not in the AST" %}';

          const { completionContext } = createLiquidParamsFromContext(context);
          expect(completionContext).to.exist;

          const { partialAst } = completionContext!;
          expectPath(partialAst, 'type').to.eql('Document');
          expectPath(partialAst, 'name').to.eql('#document');

          expectPath(partialAst, 'children.0.type').to.eql('LiquidVariableOutput');
          expectPath(partialAst, 'children.0.markup.type').to.eql('LiquidVariable');
          expectPath(partialAst, 'children.0.markup.expression.type').to.eql('String');
          expectPath(partialAst, 'children.0.markup.expression.value').to.eql('hey');
          expectPath(partialAst, 'children.0.markup.rawSource').to.eql('"hey"');

          expectPath(partialAst, 'children.1.type').to.eql('LiquidVariableOutput');
          expectPath(partialAst, 'children.1.markup.type').to.eql('LiquidVariable');
          expectPath(partialAst, 'children.1.markup.expression.type').to.eql('VariableLookup');
          expectPath(partialAst, 'children.1.markup.expression.name').to.eql('product');
          expectPath(partialAst, 'children.1.markup.expression.lookups.0.type').to.eql('String');
          expectPath(partialAst, 'children.1.markup.expression.lookups.0.value').to.eql('id');
          expectPath(partialAst, 'children.1.markup.rawSource').to.eql('product.id');

          expectPath(partialAst, 'children.2.name').to.eql('ren');
          expectPath(partialAst, 'children.2.markup').to.eql('');
          expectPath(partialAst, 'children.2.type').to.eql('LiquidTag');

          expectPath(partialAst, 'children.3').not.to.exist;
        });
      });

      describe('completionContext.node', async () => {
        it('returns the node under the cursor on simple cases', async () => {
          const context = '{{ "hey" }}\n\n{{ product.id }}{% ren█ %}';

          const { completionContext } = createLiquidParamsFromContext(context);
          expect(completionContext).to.exist;

          const { node } = completionContext!;
          expectPath(node, 'name').to.eql('ren');
          expectPath(node, 'markup').to.eql('');
          expectPath(node, 'type').to.eql('LiquidTag');
          expectPath(node, 'position.start').to.eql(29);
          expectPath(node, 'position.end').to.eql(37);
        });

        it('returns the node under the cursor on nested contexts', async () => {
          const context = `
            {% if product.compare_at_price > product.price %}
              <div>
                <h1>The product {{ product.tit█ }} is on sale!</h1>
              </div>
            {% endif %}
          `;

          const { completionContext } = createLiquidParamsFromContext(context);
          expect(completionContext).to.exist;

          const { node } = completionContext!;
          expectPath(node, 'type').to.eql('VariableLookup');
          expectPath(node, 'name').to.eql('product');
          expectPath(node, 'lookups.0.type').to.eql('String');
          expectPath(node, 'lookups.0.position.start').to.eql(126);
          expectPath(node, 'lookups.0.position.end').to.eql(129);
          expectPath(node, 'lookups.0.value').to.eql('tit');
          expectPath(node, 'position.start').to.eql(118);
          expectPath(node, 'position.end').to.eql(129);
        });
      });

      it("returns undefined when you're outside the node", async () => {
        const contexts = [
          `{% assign x = b %}█`,
          `<a href="...">█`,
          `<a href="...">█`,
          `{% for x in y rev %}█`,
          `{% cycle %}█`,
          `{% if %}█`,
          `{% assign x %}`,
          `<img>█`,
          `<self-closing />█`,
          `<a></a>█`,
        ];
        for (const context of contexts) {
          const { completionContext } = createLiquidParamsFromContext(context);
          const { node } = completionContext!;
          expect(node, context).to.eql(undefined);
        }
      });

      it('returns the HtmlVoidElement node when inside the tag', async () => {
        const context = '<img█';
        const { completionContext } = createLiquidParamsFromContext(context);
        const { node } = completionContext!;
        expectPath(node, 'type', context).to.eql('HtmlVoidElement');
      });

      it("returns the TextNode when you're completing an HTML tag name", async () => {
        const contexts = [
          `<█`,
          `<a█ href="...">`,
          `</█`,
          `</a█ href="...">`,
          `<h1></h█ href="...">`,
        ];
        for (const context of contexts) {
          const { completionContext } = createLiquidParamsFromContext(context);
          const { node } = completionContext!;
          expectPath(node, 'type', context).to.eql('TextNode');
        }
      });

      it('returns a tag', async () => {
        const contexts = [
          `{% t█ %}`,
          `{% end█ %}`,
          `{% if cond %}{% end█ %}`,
          `{% for markup as string █ %}`,
          `{% if markup as string █ %}`,
          `{% for x in y reversed █ %}`,
          `{% for x in y reversed limit: 10 █ %}`,
        ];

        for (const context of contexts) {
          const { completionContext } = createLiquidParamsFromContext(context);
          const { node } = completionContext!;
          expectPath(node, 'type', context).to.eql('LiquidTag');
        }
      });

      it('returns a variable lookup', async () => {
        const contexts = [
          `{{ a█`,
          `{{ a.b█`,
          `{{ a['b█`,
          `{{ a.b.c█`,
          `{% echo a█ %}`,
          `{% echo a.b█ %}`,
          `{% echo a['b█ %}`,
          `{% assign x = a█ %}`,
          `{% assign x = a.b█ %}`,
          `{% assign x = a['b█ %}`,
          `{% for a in b█ %}`,
          `{% for a in b reversed limit: a█ %}`,
          `{% paginate b by a█ %}`,
          `{% paginate b by col, window_size: a█ %}`,
          `{% if a█ %}`,
          `{% if a > b█ %}`,
          `{% if a > b or c█ %}`,
          `{% if a > b or c > d█ %}`,
          `{% elsif a > b█ %}`,
          `{% when a█ %}`,
          `{% when a, b█ %}`,
          `{% cycle a█ %}`,
          `{% cycle 'foo', a█ %}`,
          `{% cycle 'foo': a█ %}`,
          `{% render 'snip', var: a█ %}`,
          `{% render 'snip' for col█ as item %}`,
          `{% render 'snip' with object█ as name %}`,
          `{% liquid
            echo a█
           %}`,
          `{% for x in (1..a█) %}`,
          // `{% paginate a█ by 50 %}`,
          `<a-{{ a█ }}`,
          `<a data-{{ a█ }}`,
          `<a data={{ a█ }}`,
          `<a data="{{ a█ }}"`,
          `<a data='x{{ a█ }}'`,
        ];
        for (const context of contexts) {
          const { completionContext } = createLiquidParamsFromContext(context);
          const { node } = completionContext!;
          expectPath(node, 'type', context).to.eql('VariableLookup');
        }
      });

      it('returns a variable lookup (placeholder mode)', async () => {
        const contexts = [
          `{{ █`,
          `{{ a.█`,
          `{{ a['█`,
          `{{ a.b.█`,
          `{% echo █ %}`,
          `{% echo a.█ %}`,
          `{% echo a['█ %}`,
          `{% assign x = █ %}`,
          `{% assign x = a.█ %}`,
          `{% assign x = a['█ %}`,
          `{% for a in █ %}`,
          `{% for a in b reversed limit: █ %}`,
          `{% paginate b by █ %}`,
          `{% paginate b by col, window_size: █ %}`,
          `{% if █ %}`,
          `{% if a > █ %}`,
          `{% if a > b or █ %}`,
          `{% if a > b or c > █ %}`,
          `{% elsif a > █ %}`,
          `{% when █ %}`,
          `{% when a, █ %}`,
          `{% cycle █ %}`,
          `{% cycle 'foo', █ %}`,
          `{% cycle 'foo': █ %}`,
          `{% render 'snip', var: █ %}`,
          `{% render 'snip' for █ as item %}`,
          `{% render 'snip' with █ as name %}`,
          `{% for x in (1..█) %}`,
          // `{% paginate a█ by 50 %}`,
          `<a-{{ █ }}`,
          `<a data-{{ █ }}`,
          `<a data={{ █ }}`,
          `<a data="{{ █ }}"`,
          `<a data='x{{ █ }}'`,
        ];
        for (const context of contexts) {
          const { completionContext } = createLiquidParamsFromContext(context);
          expect(completionContext).to.exist;
          const { node } = completionContext!;
          expectPath(node, 'type', context).to.eql('VariableLookup');
        }
      });
    });
  });
});

function expectPath(ast: LiquidHtmlNode | undefined, path: string, message?: string) {
  if (!ast) return expect(ast, message);
  return expect(deepGet(path.split('.'), ast), message);
}

function deepGet<T = any>(path: (string | number)[], obj: any): T {
  return path.reduce((curr: any, k: string | number) => {
    if (curr && curr[k] !== undefined) return curr[k];
    return undefined;
  }, obj);
}

function createLiquidParamsFromContext(
  context: string,
  cursorPosition: Position = calculatePosition(context),
) {
  const regex = new RegExp('█', 'g');
  const documentManager = new DocumentManager();
  const uri = 'file:///path/to/file.liquid';
  documentManager.open(uri, context.replace(regex, ''), 1);
  const params = mockCompletionParams({ position: cursorPosition });
  return createLiquidCompletionParams(documentManager.get(uri)!, params);
}

function calculatePosition(context: string): Position {
  const index = context.indexOf('█');
  const lines = context.substring(0, index === -1 ? context.length : index).split('\n');
  const line = lines.length - 1;
  const character = lines[line].length;

  return { line, character };
}

function mockCompletionParams(params: Partial<CompletionParams> = {}): CompletionParams {
  return {
    position: {
      character: 0,
      line: 0,
    },
    textDocument: {
      uri: '/path/to/file.liquid',
    },
    ...params,
  };
}
