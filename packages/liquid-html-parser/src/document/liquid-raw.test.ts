import { describe, it, expect } from 'vitest';
import { toLiquidHtmlAST, toLiquidAST, RawMarkupKinds } from '../ast';
import {
  expectPath,
  expectPosition,
  expectBlockStartPosition,
  expectBlockEndPosition,
  sourceAt,
} from './test-helpers';

describe('Unit: liquid-raw', () => {
  it('should parse basic raw tag', () => {
    const ast = toLiquidHtmlAST('{% raw %}hello world{% endraw %}');
    expectPath(ast, 'children').to.have.lengthOf(1);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('raw');
    expectPath(ast, 'children.0.markup').to.eql('');
    expectPath(ast, 'children.0.body.type').to.eql('RawMarkup');
    expectPath(ast, 'children.0.body.value').to.eql('hello world');
    expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(1);
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.0.value').to.eql('hello world');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.text);
  });

  it('should parse comment tag', () => {
    const ast = toLiquidHtmlAST('{% comment %}this is a comment{% endcomment %}');
    expectPath(ast, 'children').to.have.lengthOf(1);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('comment');
    expectPath(ast, 'children.0.body.value').to.eql('this is a comment');
    expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(1);
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.0.value').to.eql('this is a comment');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.text);
  });

  it('should parse schema tag', () => {
    const ast = toLiquidHtmlAST('{% schema %}{"key": "value"}{% endschema %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('schema');
    expectPath(ast, 'children.0.body.value').to.eql('{"key": "value"}');
    expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(1);
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.0.value').to.eql('{"key": "value"}');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.json);
  });

  it('should parse style tag with plain body', () => {
    const ast = toLiquidHtmlAST('{% style %}.foo { color: red }{% endstyle %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.css);
    expectPath(ast, 'children.0.body.value').to.eql('.foo { color: red }');
  });

  it('should parse style tag with Liquid in body', () => {
    const ast = toLiquidHtmlAST('{% style %}.foo { color: {{ color }} }{% endstyle %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.text);
    expectPath(ast, 'children.0.body.value').to.eql('.foo { color: {{ color }} }');
    // nodes should contain TextNode and LiquidVariableOutput interleaved
    expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(3);
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.0.value').to.eql('.foo { color:');
    expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.body.nodes.2.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.2.value').to.eql('}');
  });

  it('should parse javascript tag with Liquid in body', () => {
    const ast = toLiquidHtmlAST('{% javascript %}var x = {{ value }};{% endjavascript %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('javascript');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.javascript);
    expectPath(ast, 'children.0.body.value').to.eql('var x = {{ value }};');
    expectPath(ast, 'children.0.body.nodes').to.have.lengthOf(3);
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.0.value').to.eql('var x =');
    expectPath(ast, 'children.0.body.nodes.1.type').to.eql('LiquidVariableOutput');
    expectPath(ast, 'children.0.body.nodes.2.type').to.eql('TextNode');
    expectPath(ast, 'children.0.body.nodes.2.value').to.eql(';');
  });

  it('should parse empty doc tag', () => {
    const ast = toLiquidAST('{% doc %}{% enddoc %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('doc');
    expectPath(ast, 'children.0.body.value').to.eql('');
    expectPath(ast, 'children.0.body.nodes').to.eql([]);
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.text);
  });

  it('should parse doc tag with param content', () => {
    const ast = toLiquidAST('{% doc %}@param {String} name - description{% enddoc %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('doc');
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidDocParamNode');
    expectPath(ast, 'children.0.body.nodes.0.paramName.value').to.eql('name');
  });

  it('should handle whitespace stripping on open and close', () => {
    const ast = toLiquidHtmlAST('{%- raw -%}hello{%- endraw -%}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.whitespaceStart').to.eql('-');
    expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
    expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('-');
    expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
    expectPath(ast, 'children.0.body.value').to.eql('hello');
  });

  it('should track raw tag markup position', () => {
    const source = '{% raw foo %}{% endraw %}';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.markup').to.eql('foo');
    expect(sourceAt(source, (ast.children[0] as any).markupPosition)).to.eql('foo');
  });

  it('should track whitespace-stripped raw tag markup position', () => {
    const source = '{%- raw foo -%}{%- endraw -%}';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.markup').to.eql('foo');
    expect(sourceAt(source, (ast.children[0] as any).markupPosition)).to.eql('foo');
  });

  it('should track positions correctly with prefix', () => {
    const source = 'XXXXX{% raw %}hello{% endraw %}';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children').to.have.lengthOf(2);
    // TextNode for "XXXXX"
    expectPath(ast, 'children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.value').to.eql('XXXXX');
    // LiquidRawTag
    expectBlockStartPosition(ast, 'children.1').to.eql('{% raw %}');
    expectBlockEndPosition(ast, 'children.1').to.eql('{% endraw %}');
    expectPosition(ast, 'children.1.body').to.eql('hello');
    expectPosition(ast, 'children.1').to.eql('{% raw %}hello{% endraw %}');
  });

  it('should map RawMarkupKinds correctly for each tag name', () => {
    const cases: [string, RawMarkupKinds][] = [
      ['raw', RawMarkupKinds.text],
      ['comment', RawMarkupKinds.text],
      ['schema', RawMarkupKinds.json],
      ['javascript', RawMarkupKinds.javascript],
      ['style', RawMarkupKinds.css],
      ['stylesheet', RawMarkupKinds.css],
      ['doc', RawMarkupKinds.text],
    ];
    for (const [tagName, expectedKind] of cases) {
      const ast = toLiquidAST(`{% ${tagName} %}body{% end${tagName} %}`);
      expectPath(ast, 'children.0.body.kind').to.eql(expectedKind);
    }
  });

  it('should parse empty body', () => {
    const ast = toLiquidHtmlAST('{% raw %}{% endraw %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.body.value').to.eql('');
    expectPath(ast, 'children.0.body.nodes').to.eql([]);
  });

  it('should preserve newlines in multiline body', () => {
    const ast = toLiquidHtmlAST('{% comment %}\nline1\nline2\n{% endcomment %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.body.value').to.eql('\nline1\nline2\n');
  });

  it('should throw for unclosed raw tag', () => {
    expect(() => toLiquidHtmlAST('{% raw %}hello')).to.throw();
  });

  it('should work with toLiquidAST', () => {
    const ast = toLiquidAST('{% raw %}hello{% endraw %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('raw');
    expectPath(ast, 'children.0.body.value').to.eql('hello');
  });

  it('should parse stylesheet tag', () => {
    const ast = toLiquidHtmlAST('{% stylesheet %}.cls { }{% endstylesheet %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('stylesheet');
    expectPath(ast, 'children.0.body.kind').to.eql(RawMarkupKinds.css);
  });

  it('should parse doc tag whose body contains liquid-like syntax', () => {
    // Regression: the doc body contains {% render ... } (note: `}` not `%}`)
    // which caused the tokenizer to enter LiquidTag mode and swallow the
    // {%- enddoc -%} close tag into a mangled token.
    const source = [
      '{%- doc -%}',
      '  @param {object} price - The price.',
      '  @example',
      "  {% render 'unit-price', price: variant.unit_price }",
      '{%- enddoc -%}',
      'after',
    ].join('\n');
    const ast = toLiquidAST(source);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('doc');
    expectPath(ast, 'children.0.whitespaceStart').to.eql('-');
    expectPath(ast, 'children.0.whitespaceEnd').to.eql('-');
    expectPath(ast, 'children.0.delimiterWhitespaceStart').to.eql('-');
    expectPath(ast, 'children.0.delimiterWhitespaceEnd').to.eql('-');
    // Body should contain the full text between doc and enddoc
    expect(ast.children[0]).to.have.property('body');
    const body = (ast.children[0] as any).body;
    expect(body.value).to.contain('@param');
    expect(body.value).to.contain("{% render 'unit-price'");
    // "after" text should be a sibling, not swallowed into the doc body
    expectPath(ast, 'children.1.type').to.eql('TextNode');
    expectPath(ast, 'children.1.value').to.contain('after');
  });

  it('should parse style tag with Liquid tag in body', () => {
    const ast = toLiquidHtmlAST('{% style %}{% if true %}.active{}{% endif %}{% endstyle %}');
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.body.nodes.0.name').to.eql('if');
  });

  it('preserves output after endraw when an unclosed {{ in the body straddles the boundary', () => {
    // Regression (#2895): the unclosed `{{ invalid` inside the raw body opens a
    // LiquidVariableOutput token in the tokenizer that greedily runs past the
    // {% endraw %} to the next `}}`, so the straddling token used to swallow
    // the real trailing `{{ 1 }}`. After the fix the parser re-tokenizes from
    // the end-tag boundary, so the trailing output survives as its own node.
    const source = '{% raw %} Foobar {{ invalid {% endraw %}{{ 1 }}';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children').to.have.lengthOf(2);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.body.value').to.eql(' Foobar {{ invalid ');
    expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
    expectPosition(ast, 'children.1').to.eql('{{ 1 }}');
  });

  it('preserves plain text after endraw when the raw body contains a stray {{', () => {
    // Companion to #2895: a stray `{{` with no following `}}` after endraw must
    // not consume the post-endraw text either.
    const source = '{% raw %}{{ a {% endraw %}tail';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.body.value').to.eql('{{ a ');
    expectPath(ast, 'children.1.type').to.eql('TextNode');
    expectPath(ast, 'children.1.value').to.eql('tail');
  });

  it('re-tokenizes a straddling endraw inside a quoted attribute without losing quote context', () => {
    // Regression: when a raw tag inside a quoted HTML attribute has a stray `{{`
    // in its body, the `}}` close straddles the {% endraw %} boundary. The
    // boundary reslice used to re-tokenize the suffix from document-start mode,
    // so the attribute's closing `"` and `>` became Text instead of
    // HtmlQuoteClose/HtmlTagClose and attribute parsing threw
    // "Expected HtmlQuoteClose". The reslice now resumes in QuotedValue mode, so
    // the attribute closes cleanly and the element body parses normally.
    const source = '<div data="{% raw %}{{ invalid {% endraw %}">x</div>';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.value').to.eql('div');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrDoubleQuoted');
    expectPath(ast, 'children.0.attributes.0.name.0.value').to.eql('data');
    expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.0.value').to.eql('x');
  });

  it('handles a straddling endraw inside a single-quoted attribute', () => {
    // Companion to the double-quoted case: the recovered quote char must match
    // whatever opened the attribute, so single quotes close on `'` too.
    const source = "<div data='{% raw %}{{ invalid {% endraw %}'>y</div>";
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.attributes.0.type').to.eql('AttrSingleQuoted');
    expectPath(ast, 'children.0.attributes.0.value.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.children.0.value').to.eql('y');
  });

  it('recovers HtmlTag context for a straddling endraw in an unquoted attribute position', () => {
    // Regression: a stray `{{` in the raw body opens LiquidVariableOutput mode
    // that runs past {% endraw %} to the next `}}`, straddling the boundary. The
    // suffix reslice used to re-tokenize from Default mode, where `>` stays Text
    // (only HtmlTag mode emits HtmlTagClose), so the attribute list never broke
    // on the tag close, consumed `</div>`'s `>`, and parseHtmlElement threw at
    // EOF with the element still open. The reslice now resumes in HtmlTag mode,
    // so the element closes on its real `>` and its body parses normally.
    const source = '<div {% raw %}{{ invalid {% endraw %}{{ 1 }} data-x="1">ok</div>';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('HtmlElement');
    expectPath(ast, 'children.0.name.0.value').to.eql('div');
    expectPath(ast, 'children.0.children.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.0.value').to.eql('ok');
  });

  it('does not duplicate a straddling {{ into both a Liquid-in-body raw body and a sibling', () => {
    // Regression: for parseLiquidInBody raw tags (style/javascript/stylesheet)
    // the body is parsed before the boundary reslice. A stray `{{` whose `}}`
    // lands past {% endstyle %} used to be consumed into the body (a node
    // spanning past the end tag) AND re-emitted as a post-tag sibling — the same
    // source range in two overlapping nodes. The body parse now clamps a
    // construct that does not close within the body to literal text, so
    // `body.nodes` matches `body.value` and only the sibling carries `{{ 1 }}`.
    const source = '{% style %}{{ invalid {% endstyle %}{{ 1 }}';
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children').to.have.lengthOf(2);
    expectPath(ast, 'children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.name').to.eql('style');
    expectPath(ast, 'children.0.body.value').to.eql('{{ invalid ');
    // Body node must not extend past the end tag (no overlap with the sibling).
    expectPath(ast, 'children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.1.type').to.eql('LiquidVariableOutput');
    expectPosition(ast, 'children.1').to.eql('{{ 1 }}');
  });

  it('does not let a decoy endcommentXXXXX close the comment; only the real endcomment does', () => {
    // Regression (#2855, CommentTagUnitTest#test_ignores_delimiter_with_extra_strings):
    // a comment closes on the tag NAME `endcomment`, and `endcommentXXXXX` is a
    // genuinely different tag name, so the decoy `{% endcommentXXXXX %}` must NOT
    // terminate the raw comment body — only the real `{% endcomment %}` closes it,
    // and the decoy open/close and its inner "wut" are swallowed as comment body
    // text. (Note: Ruby's `FullToken` group 2 `(#|\w+)` matches the `endcomment`
    // name regardless of trailing markup; the JS `scanForEndTag` `\s*%}` anchor is
    // a JS-implementation detail that is stricter than Ruby, not the parity rule.
    // It is irrelevant to the decoy case here, where the name itself differs.)
    const source = [
      '{% if true %}',
      '  {% comment %}',
      '    {% commentXXXXX %}wut{% endcommentXXXXX %}',
      '  {% endcomment %}',
      '{% endif %}',
    ].join('\n');
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('if');
    // The comment raw tag lives in the if-branch and swallows the decoy as text.
    expectPath(ast, 'children.0.children.0.children.0.type').to.eql('LiquidRawTag');
    expectPath(ast, 'children.0.children.0.children.0.name').to.eql('comment');
    expectPath(ast, 'children.0.children.0.children.0.body.value').to.contain(
      '{% commentXXXXX %}wut{% endcommentXXXXX %}',
    );
    // The decoy is captured as a single TextNode, not parsed as a nested tag.
    expectPath(ast, 'children.0.children.0.children.0.body.nodes').to.have.lengthOf(1);
    expectPath(ast, 'children.0.children.0.children.0.body.nodes.0.type').to.eql('TextNode');
    expectPath(ast, 'children.0.children.0.children.0.body.nodes.0.value').to.eql(
      '{% commentXXXXX %}wut{% endcommentXXXXX %}',
    );
    // The real {% endcomment %} closes the comment, so the comment is the only
    // child of the if-branch (the decoy did not leak siblings into the branch).
    expectPath(ast, 'children.0.children.0.children').to.have.lengthOf(1);
  });

  it('parses a malformed {%comment}...{%endcomment} (no %}) into two flat base-case tags without throwing', () => {
    // Parse-level documentation for #2854 (CommentTagUnitTest#test_delimiter_can_have_extra_strings).
    // `{%comment}` has no closing `%}`, so the tokenizer scans to the first `%}`
    // and reads `{%comment}{% assign a = 1 %}` as one base-case LiquidTag and the
    // trailing `{%endcomment}{% endif %}` as another. JS splits the tag name on the
    // first whitespace, so the two names are `comment}{%` and `endcomment}{%` — two
    // flat sibling nodes, and the template parses without throwing.
    //
    // This only asserts the strict parse shape; it does NOT assert a render result.
    // The spec is currently DEFERRED (see RENDER_TREE_SPEC_GAPS, #2854): the
    // parity-faithful behaviour (Ruby extracts the tag name as the leading `(#|\w+)`
    // run, yielding a `comment` block that swallows the rest and renders `''`) needs
    // a strict-parser tag-name-extraction change in envelopeFromTokens that would
    // alter the shared toLiquidHtmlAST AST consumed by theme-check (DD-7), so it is
    // out of scope here.
    const source = '{%comment}{% assign a = 1 %}{%endcomment}{% endif %}';
    expect(() => toLiquidHtmlAST(source)).not.to.throw();
    const ast = toLiquidHtmlAST(source);
    expectPath(ast, 'children').to.have.lengthOf(2);
    expectPath(ast, 'children.0.type').to.eql('LiquidTag');
    expectPath(ast, 'children.0.name').to.eql('comment}{%');
    expectPath(ast, 'children.1.type').to.eql('LiquidTag');
    expectPath(ast, 'children.1.name').to.eql('endcomment}{%');
  });

  it('distinguishes a trimming endraw -%} from a non-trimming endraw %}', () => {
    // Regression (#2898): the closing-delimiter trim must be recorded on
    // delimiterWhitespaceEnd, independent of the opening raw -%} trim
    // (whitespaceEnd). Two templates that differ only in the endraw marker
    // must produce different delimiterWhitespaceEnd values.
    const trimmed = toLiquidHtmlAST('> {%- raw -%} inner {%- endraw -%} <');
    expectPath(trimmed, 'children.1.type').to.eql('LiquidRawTag');
    expectPath(trimmed, 'children.1.whitespaceEnd').to.eql('-');
    expectPath(trimmed, 'children.1.delimiterWhitespaceEnd').to.eql('-');

    const notTrimmed = toLiquidHtmlAST('> {%- raw -%} inner {%- endraw %} <');
    expectPath(notTrimmed, 'children.1.type').to.eql('LiquidRawTag');
    expectPath(notTrimmed, 'children.1.whitespaceEnd').to.eql('-');
    expectPath(notTrimmed, 'children.1.delimiterWhitespaceEnd').to.eql('');
  });
});
