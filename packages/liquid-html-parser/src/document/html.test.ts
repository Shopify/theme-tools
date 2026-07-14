import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST } from '../ast';
import { deepGet } from '../utils';
import { expectPath, expectPosition } from './test-helpers';

describe('Unit: html', () => {
  it('should parse a simple HTML element', () => {
    const ast = toLiquidHtmlAST('<div>hello</div>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.value').to.eql('div');
    expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.0.value').to.eql('hello');
    expectPosition(ast, 'children.0').to.eql('<div>hello</div>');
  });

  it('should parse nested HTML elements', () => {
    const ast = toLiquidHtmlAST('<div><span>text</span></div>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.value').to.eql('div');
    expectPath(ast, 'children.0.children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.children.0.name.0.value').to.eql('span');
    expectPath(ast, 'children.0.children.0.children.0.value').to.eql('text');
  });

  it('should parse void elements', () => {
    const ast = toLiquidHtmlAST('<br>');
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.name').to.eql('br');
    expectPosition(ast, 'children.0').to.eql('<br>');
  });

  it('should parse void elements with attributes', () => {
    const ast = toLiquidHtmlAST('<img src="photo.jpg">');
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.name').to.eql('img');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrDoubleQuoted');
    expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('src');
    expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql('photo.jpg');
  });

  it('should parse self-closing elements', () => {
    const ast = toLiquidHtmlAST('<div />');
    expectPath(ast, 'children.0.type').to.eql('HtmlSelfClosingElement');
    expectPath(ast, 'children.0.name.0.value').to.eql('div');
    expectPosition(ast, 'children.0').to.eql('<div />');
  });

  it('should parse all attribute types', () => {
    const source = '<img src="x" loading=\'lazy\' disabled checked="">';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrDoubleQuoted');
    expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('src');
    expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql('x');
    expectPath(ast, 'children.0.attributes.1.type').to.eql('AttrSingleQuoted');
    expectPath(ast, 'children.0.attributes.1.name.0.value').to.eql('loading');
    expectPath(ast, 'children.0.attributes.1.value.0.value').to.eql('lazy');
    expectPath(ast, 'children.0.attributes.2.type').to.eql('AttrEmpty');
    expectPath(ast, 'children.0.attributes.2.name.0.value').to.eql('disabled');
    expectPath(ast, 'children.0.attributes.3.type').to.eql('AttrDoubleQuoted');
    expectPath(ast, 'children.0.attributes.3.name.0.value').to.eql('checked');
  });

  it('should parse unquoted attribute values', () => {
    const ast = toLiquidHtmlAST('<div class=foo>bar</div>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrUnquoted');
    expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('class');
    expectPath(ast, 'children.0.attributes.0.value.0.value').to.eql('foo');
  });

  it('should parse Liquid drops in attribute values', () => {
    const ast = toLiquidHtmlAST('<div class="{{ x }}">text</div>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrDoubleQuoted');
    expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('LiquidVariableOutput');
  });

  it('should parse Liquid tags between attributes', () => {
    const ast = toLiquidHtmlAST('<img {% if cond %}src="x"{% endif %}>');
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('LiquidTag');
  });

  it('should NOT swallow a Liquid tag glued to an attribute name into the name', () => {
    // Regression: `data-dock{% if %}...{% endif %}` (no space before `{%`) must parse
    // as a bare `data-dock` attribute followed by a separate attribute-position
    // Liquid tag, NOT as one AttrEmpty whose name contains the raw `{% if %}` block.
    const ast = toLiquidHtmlAST(
      `<s-scroll-dock class="block" data-dock{% if template == 'index' %} data-immersive{% endif %}></s-scroll-dock>`,
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrDoubleQuoted');
    expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('class');
    expectPath(ast, 'children.0.attributes.1.type').to.eql('AttrEmpty');
    expectPath(ast, 'children.0.attributes.1.name').to.have.lengthOf(1);
    expectPath(ast, 'children.0.attributes.1.name.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.attributes.1.name.0.value').to.eql('data-dock');
    expectPath(ast, 'children.0.attributes.2.type').to.eql('LiquidTag');
  });

  it('should parse a Liquid tag glued to an attribute name on a void element', () => {
    const ast = toLiquidHtmlAST(`<img data-x{% if cond %} data-y{% endif %}>`);
    expectPath(ast, 'children.0.type').to.eql('HtmlVoidElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrEmpty');
    expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('data-x');
    expectPath(ast, 'children.0.attributes.1.type').to.eql('LiquidTag');
  });

  it('should parse compound tag names with Liquid drops', () => {
    const ast = toLiquidHtmlAST('<{{ node_type }}>content</{{ node_type }}>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.children.0.value').to.eql('content');
  });

  it('should parse compound names with text and Liquid segments', () => {
    const ast = toLiquidHtmlAST('<{{ type }}--header></{{ type }}--header>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(2);
    expectPath(ast, 'children.0.name.0.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.name.1.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.1.value').to.eql('--header');
  });

  it('should parse compound tag names with Liquid tags (conditionals)', () => {
    const ast = toLiquidHtmlAST(
      '<{% if true %}sticky-header{% else %}div{% endif %}>content</{% if true %}sticky-header{% else %}div{% endif %}>',
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.children.0.value').to.eql('content');
  });

  it('should parse compound tag names mixing Liquid tags and text', () => {
    const ast = toLiquidHtmlAST(
      '<{% if true %}sticky{% endif %}-header>content</{% if true %}sticky{% endif %}-header>',
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(2);
    expectPath(ast, 'children.0.name.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name.1.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.1.value').to.eql('-header');
  });

  it('should treat a Liquid tag glued to a text tag name as an attribute, not part of the name', () => {
    // Regression: `<li{% if %}...{% endif %}>` (no space) previously folded the
    // conditional into the tag name, producing a compound name that failed to
    // match the plain `</li>` close tag and blanked the whole block.
    const ast = toLiquidHtmlAST(`<li{% if cond %} data-x class="hidden"{% endif %}>content</li>`);
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(1);
    expectPath(ast, 'children.0.name.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.0.value').to.eql('li');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('LiquidTag');
  });

  it('should treat any block tag glued to a text tag name as an attribute', () => {
    // The same bug affected every block tag, not just `if`.
    for (const src of [
      `<li{% unless cond %} data-x{% endunless %}>c</li>`,
      `<ul{% for i in (1..2) %} data-i{% endfor %}>c</ul>`,
      `<li{% case x %}{% when 'a' %} data-a{% endcase %}>c</li>`,
    ]) {
      const ast = toLiquidHtmlAST(src);
      expectPath(ast, 'children.0.type').to.eql('HtmlElement');
      expectPath(ast, 'children.0.name').to.have.lengthOf(1);
      expectPath(ast, 'children.0.name.0.type').to.eql('TextNode');
      expectPath(ast, 'children.0.attributes.0.type').to.eql('LiquidTag');
    }
  });

  it('should still parse a name built from consecutive Liquid conditionals', () => {
    // Must NOT regress: with no leading text, consecutive blocks form the name.
    const ast = toLiquidHtmlAST(
      '<{% if a %}x{% endif %}{% if b %}y{% endif %}>content</{% if a %}x{% endif %}{% if b %}y{% endif %}>',
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(2);
    expectPath(ast, 'children.0.name.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name.1.type').to.eql('LiquidTag');
  });

  it('should parse a Liquid-led compound name with interior text and a trailing conditional', () => {
    // A conditional following interior text must still be folded into the name
    // when the name is Liquid-led (no whitespace-led body), e.g.
    // `<{% if a %}x{% endif %}-{% if b %}y{% endif %}>`. The whitespace heuristic
    // keys off the tag body, not merely the presence of a TextNode segment.
    const ast = toLiquidHtmlAST(
      '<{% if a %}x{% endif %}-{% if b %}y{% endif %}>content</{% if a %}x{% endif %}-{% if b %}y{% endif %}>',
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(3);
    expectPath(ast, 'children.0.name.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name.1.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.2.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.attributes').to.have.lengthOf(0);
  });

  it('should fold a standalone Liquid tag glued to a text name into the name (like a drop)', () => {
    // Standalone tags (`echo`, `cycle`, ...) have no body, so the whitespace
    // heuristic must not treat following content as their body. They output into
    // the name like `{{ }}`, and must parse symmetrically on open and close
    // (regression: open/close name mismatch threw and blanked the element).
    const ast = toLiquidHtmlAST(`<x{% echo suffix %} class="c">y</x{% echo suffix %}>`);
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(2);
    expectPath(ast, 'children.0.name.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.1.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.attributes').to.have.lengthOf(1);
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrDoubleQuoted');
  });

  it('should treat a trim-delimited conditional body as content-led, not whitespace-led', () => {
    // `-%}` strips the body's leading whitespace, so the rendered body is `y` —
    // a name continuation, not an attribute list.
    const ast = toLiquidHtmlAST(
      `<component-{% if c -%} y{% endif %}>z</component-{% if c -%} y{% endif %}>`,
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(2);
    expectPath(ast, 'children.0.name.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.1.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.attributes').to.have.lengthOf(0);
  });

  it('should treat whitespace before a left-trimming drop as stripped (content-led body)', () => {
    // `{{-` strips the preceding whitespace, so the rendered body is `suffix` —
    // a name continuation, not an attribute list.
    const ast = toLiquidHtmlAST(
      `<x{% if c %} {{- suffix }}{% endif %}>y</x{% if c %} {{- suffix }}{% endif %}>`,
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name').to.have.lengthOf(2);
    expectPath(ast, 'children.0.name.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.name.1.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.attributes').to.have.lengthOf(0);
  });

  it('accepts conditional tag names whose branch content differs (Ruby parity)', () => {
    // The open/close tag names are wholly a Liquid {% if %} block, so the
    // resolved name is decided at runtime and cannot be matched statically.
    // Ruby's parser does not enforce open/close matching here; the editor
    // trusts the pair instead of throwing.
    const ast = toLiquidHtmlAST(
      '<{% if x %}a{% else %}b{% endif %}>content</{% if x %}a{% else %}z{% endif %}>',
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
  });

  it('parses a dynamic tag name whose open branch glues an attribute (Dawn header pattern)', () => {
    // Dawn's header.liquid: <{% if ... %}sticky-header data-sticky-type="..."{% else %}div{% endif %} class="...">
    // ... </{% if ... %}sticky-header{% else %}div{% endif %}>. The open and close
    // {% if %} blocks differ in source (the open branch also carries an
    // attribute) but resolve to the same element name; the parser must accept it.
    const ast = toLiquidHtmlAST(
      '<{% if section.settings.sticky %}sticky-header data-sticky-type="{{ section.settings.sticky }}"{% else %}div{% endif %} class="header-wrapper">content</{% if section.settings.sticky %}sticky-header{% else %}div{% endif %}>',
    );
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
  });

  it('should throw when open has conditional name but close has plain name', () => {
    expect(() => toLiquidHtmlAST('<{% if true %}div{% endif %}>content</div>')).to.throw(
      /Attempting to close HtmlElement/,
    );
  });

  it('should parse HTML comments', () => {
    const ast = toLiquidHtmlAST('<!-- hello -->');
    expectPath(ast, 'children.0.type').to.eql('HtmlComment');
    expectPath(ast, 'children.0.body').to.eql('hello');
    expectPosition(ast, 'children.0').to.eql('<!-- hello -->');
  });

  it('should parse script tags as HtmlRawNode', () => {
    const ast = toLiquidHtmlAST('<script>var x = 1;</script>');
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.name').to.eql('script');
    expectPath(ast, 'children.0.body.kind').to.eql('javascript');
    expectPath(ast, 'children.0.body.value').to.eql('var x = 1;');
    expectPosition(ast, 'children.0').to.eql('<script>var x = 1;</script>');
  });

  it('should parse style tags as HtmlRawNode', () => {
    const ast = toLiquidHtmlAST('<style>.x { color: red; }</style>');
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body.kind').to.eql('css');
    expectPath(ast, 'children.0.body.value').to.eql('.x { color: red; }');
  });

  it('should parse Liquid drops inside raw HTML body', () => {
    const ast = toLiquidHtmlAST('<script>const a = {{ product | json }};</script>');
    expectPath(ast, 'children.0.type').to.eql('HtmlRawNode');
    expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(3);
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.body.nodes.2.type').to.eql('TextNode');
  });

  it('should parse HTML doctype', () => {
    const ast = toLiquidHtmlAST('<!DOCTYPE html>');
    expectPath(ast, 'children.0.type').to.eql('HtmlDoctype');
    expectPath(ast, 'children.0.legacyDoctypeString').to.eql(null);
    expectPosition(ast, 'children.0').to.eql('<!DOCTYPE html>');
  });

  it('should parse HTML inside Liquid blocks', () => {
    const ast = toLiquidHtmlAST('{% if x %}<div>hello</div>{% endif %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.children.0.children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.children.0.children.0.name.0.value').to.eql('div');
  });

  it('should parse Liquid inside HTML children', () => {
    const ast = toLiquidHtmlAST('<div>{{ x }}</div>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.children.0.type').to.eql('LiquidVariableOutput');
  });

  it('should parse empty HTML element', () => {
    const ast = toLiquidHtmlAST('<div></div>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.children').to.have.lengthOf(0);
  });

  it('should parse adjacent HTML elements', () => {
    const ast = toLiquidHtmlAST('<div></div><p></p>');
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.value').to.eql('div');
    expectPath(ast, 'children.1.type').to.eql('HtmlElement');
    expectPath(ast, 'children.1.name.0.value').to.eql('p');
  });

  it('should set blockStartPosition and blockEndPosition correctly', () => {
    const source = '<div class="x">content</div>';
    const ast = toLiquidHtmlAST(source);
    const el = deepGet('children.0'.split('.'), ast) as any;
    expect(source.slice(el.blockStartPosition.start, el.blockStartPosition.end)).to.eql(
      '<div class="x">',
    );
    expect(source.slice(el.blockEndPosition.start, el.blockEndPosition.end)).to.eql('</div>');
  });

  it('should set attributePosition correctly on quoted attributes', () => {
    const source = '<div class="foo">bar</div>';
    const ast = toLiquidHtmlAST(source);
    const attr = deepGet('children.0.attributes.0'.split('.'), ast) as any;
    expect(source.slice(attr.attributePosition.start, attr.attributePosition.end)).to.eql('foo');
  });

  it('should treat HTML as text in toLiquidAST mode', () => {
    const ast = toLiquidAST('<div>hello</div>');
    expectPath(ast, 'children.0.type').to.eql('TextNode');
  });

  it('should parse void elements with self-closing syntax as HtmlSelfClosingElement', () => {
    const ast = toLiquidHtmlAST('<br />');
    expectPath(ast, 'children.0.type').to.eql('HtmlSelfClosingElement');
  });

  it('should parse text after liquid tag inside quoted attribute value as TextNode, not AttrEmpty (bug 45)', () => {
    const ast = toLiquidHtmlAST(
      '<span {% if x %}class="a{% if y %} b{% endif %}"{% endif %}></span>',
    );
    const outerIf = deepGet('children.0.attributes.0'.split('.'), ast) as any;
    expect(outerIf.type).to.eql('LiquidTag');
    expect(outerIf.name).to.eql('if');

    const classAttr = outerIf.children[0].children[0];
    expect(classAttr.type).to.eql('AttrDoubleQuoted');
    expect(classAttr.name[0].value).to.eql('class');

    const innerIf = classAttr.value[1];
    expect(innerIf.type).to.eql('LiquidTag');
    expect(innerIf.name).to.eql('if');

    const branch = innerIf.children[0];
    expect(branch.type).to.eql('LiquidBranch');
    expect(branch.children.length).to.eql(1);
    expect(branch.children[0].type).to.eql('TextNode');
    expect(branch.children[0].value).to.eql(' b');
  });
});
