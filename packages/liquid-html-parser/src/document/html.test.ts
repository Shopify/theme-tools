import { describe, expect, it } from 'vitest';
import type { DocumentNode } from '../ast';
import { toLiquidHtmlAST } from '../ast';
import { Environment } from '../environment';
import { DocumentParser } from './parser';
import { tokenize } from './tokenizer';
import type { TokenizeOptions } from './tokenizer';
import { expectPath } from './test-helpers';

/**
 * Parse like `toLiquidHtmlAST` with its default options, and count how many
 * times the parser reads a token from its token array.
 */
function parseCountingTokenReads(source: string): { ast: DocumentNode; reads: number } {
  const env = Environment.default();
  const tokenizeOptions: TokenizeOptions = {
    rawTags: env,
    builtinRawTags: env.usesBuiltinTags(),
    parseHtml: true,
  };
  const tokens = tokenize(source, tokenizeOptions);
  let reads = 0;
  const countedTokens = new Proxy(tokens, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const parser = new DocumentParser(
    countedTokens,
    source,
    env,
    true,
    false,
    false,
    tokenizeOptions.rawBodyEnds,
  );
  return { ast: parser.parseDocument(), reads };
}

describe('Unit: block tags glued to a text tag name', () => {
  // A glued block opens the attribute list when its rendered body starts with
  // whitespace. An empty body renders nothing, so the first rendered token after
  // the block decides, in a later glued block or at the end of the HTML tag.
  const count = 2_000;
  const emptyBlocks = '{% if x %}{% endif %}'.repeat(count);
  const filledBlocks = '{% if x %}b{% endif %}'.repeat(count);

  it.each([
    ['a self-closing tag', (blocks: string) => `<div><a${blocks}/></div>`],
    ['an open and a close tag', (blocks: string) => `<a${blocks}>c</a${blocks}>`],
  ])(
    'reads the tokens of a name of empty blocks in %s about as often as for blocks with a body',
    (_, template) => {
      const empty = parseCountingTokenReads(template(emptyBlocks));
      const filled = parseCountingTokenReads(template(filledBlocks));

      expect(empty.reads).toBeLessThan(2 * filled.reads);
    },
  );

  it('keeps a name of empty blocks glued to a self-close as one name', () => {
    const ast = toLiquidHtmlAST(`<div><a${emptyBlocks}/></div>`);

    expectPath(ast, 'children.0.children.0.type').to.eql('HtmlSelfClosingElement');
    expectPath(ast, 'children.0.children.0.name').to.have.lengthOf(count + 1);
    expectPath(ast, 'children.0.children.0.name.0.value').to.eql('a');
    expectPath(ast, `children.0.children.0.name.${count}.type`).to.eql('LiquidTag');
    expectPath(ast, 'children.0.children.0.attributes').to.have.lengthOf(0);
  });

  it('keeps a name of empty blocks in an open and a close tag as one element', () => {
    const ast = toLiquidHtmlAST(`<a${emptyBlocks}>c</a${emptyBlocks}>`);

    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(count + 1);
    expectPath(ast, 'children.0.children.0.value').to.eql('c');
  });

  it('keeps a name of blocks with a body glued to a self-close as one name', () => {
    const ast = toLiquidHtmlAST(`<div><a${filledBlocks}/></div>`);

    expectPath(ast, 'children.0.children.0.name').to.have.lengthOf(count + 1);
    expectPath(ast, `children.0.children.0.name.${count}.children.0.children.0.value`).to.eql('b');
    expectPath(ast, 'children.0.children.0.attributes').to.have.lengthOf(0);
  });

  it('opens the attribute list at whitespace after a run of empty blocks', () => {
    const ast = toLiquidHtmlAST(`<div><a${emptyBlocks} /></div>`);

    expectPath(ast, 'children.0.children.0.name').to.have.lengthOf(1);
    expectPath(ast, 'children.0.children.0.attributes').to.have.lengthOf(count);
    expectPath(ast, `children.0.children.0.attributes.${count - 1}.type`).to.eql('LiquidTag');
  });

  it.each([
    // The look-ahead of the first block reads past the empty block to the body of
    // the second, so both blocks get the answer of that body.
    ['a whitespace-led body', '<a{% if x %}{% endif %}{% if y %} data-y{% endif %}>c</a>', 1, 2],
    [
      'a content-led body',
      '<a{% if x %}{% endif %}{% if y %}-b{% endif %}>c</a{% if x %}{% endif %}{% if y %}-b{% endif %}>',
      3,
      0,
    ],
    [
      'a trim-delimited body',
      '<a{% if x %}{% endif %}{% if y -%} b{% endif %}>c</a{% if x %}{% endif %}{% if y -%} b{% endif %}>',
      3,
      0,
    ],
    [
      'a drop',
      '<a{% if x %}{% endif %}{% if y %}{{ y }}{% endif %}>c</a{% if x %}{% endif %}{% if y %}{{ y }}{% endif %}>',
      3,
      0,
    ],
    // The body of the first block decides the first block only: the second block
    // gets the answer of its own body.
    [
      'a content-led body and then a whitespace-led body',
      '<a{% if x %}b{% endif %}{% if y %} c{% endif %}>d</a{% if x %}b{% endif %}>',
      2,
      1,
    ],
  ])('decides glued blocks after an empty block by %s', (_, source, nameLength, attributes) => {
    const ast = toLiquidHtmlAST(source);

    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(nameLength);
    expectPath(ast, 'children.0.name.0.value').to.eql('a');
    expectPath(ast, 'children.0.attributes').to.have.lengthOf(attributes);
  });
});
