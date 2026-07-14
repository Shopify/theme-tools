import { describe, expect, it } from 'vitest';
import { tokenize, TokenType } from './tokenizer';
import type { Token } from './tokenizer';

/** Strip the trailing EndOfInput token for cleaner assertions. */
function tokens(source: string): Token[] {
  return tokenize(source).slice(0, -1);
}

/** Verify structural invariants for any tokenized source. */
function assertTokenInvariants(source: string) {
  const result = tokenize(source);

  // Last token is EndOfInput at source.length
  const last = result[result.length - 1];
  expect(last.type).toBe(TokenType.EndOfInput);
  expect(last.start).toBe(source.length);
  expect(last.end).toBe(source.length);

  // No zero-width tokens (except EndOfInput), no gaps, no overlaps
  for (let i = 0; i < result.length - 1; i++) {
    const t = result[i];
    expect(t.end).toBeGreaterThan(t.start);
    if (t.type === TokenType.Text) {
      expect(t.end - t.start).toBeGreaterThan(0);
    }
    if (i < result.length - 2) {
      expect(result[i + 1].start).toBe(t.end);
    }
  }

  // Last structural token abuts EndOfInput
  if (result.length >= 2) {
    expect(result[result.length - 2].end).toBe(last.start);
  }
}

describe('Unit: document-tokenizer', () => {
  describe('basic Liquid tokens', () => {
    // "{{ x }}" len=7: 0:{ 1:{ 2:  3:x 4:  5:} 6:}
    it('tokenizes a Liquid drop {{ x }}', () => {
      const result = tokens('{{ x }}');
      expect(result).toMatchObject([
        { type: TokenType.LiquidVariableOutputOpen, start: 0, end: 2 },
        { type: TokenType.Text, start: 2, end: 5 },
        { type: TokenType.LiquidVariableOutputClose, start: 5, end: 7 },
      ]);
      assertTokenInvariants('{{ x }}');
    });

    // "{% if %}" len=8: 0:{ 1:% 2:  3:i 4:f 5:  6:% 7:}
    it('tokenizes a Liquid tag {% if %}', () => {
      const result = tokens('{% if %}');
      expect(result).toMatchObject([
        { type: TokenType.LiquidTagOpen, start: 0, end: 2 },
        { type: TokenType.Text, start: 2, end: 6 },
        { type: TokenType.LiquidTagClose, start: 6, end: 8 },
      ]);
      assertTokenInvariants('{% if %}');
    });

    // "{%- tag -%}" len=11: 0:{ 1:% 2:- 3:  4:t 5:a 6:g 7:  8:- 9:% 10:}
    it('tokenizes whitespace-trimming Liquid tag {%- tag -%}', () => {
      const result = tokens('{%- tag -%}');
      expect(result).toMatchObject([
        { type: TokenType.LiquidTagOpen, start: 0, end: 3 },
        { type: TokenType.Text, start: 3, end: 8 },
        { type: TokenType.LiquidTagClose, start: 8, end: 11 },
      ]);
      assertTokenInvariants('{%- tag -%}');
    });

    // "{{- x -}}" len=9: 0:{ 1:{ 2:- 3:  4:x 5:  6:- 7:} 8:}
    it('tokenizes whitespace-trimming Liquid drop {{- x -}}', () => {
      const result = tokens('{{- x -}}');
      expect(result).toMatchObject([
        { type: TokenType.LiquidVariableOutputOpen, start: 0, end: 3 },
        { type: TokenType.Text, start: 3, end: 6 },
        { type: TokenType.LiquidVariableOutputClose, start: 6, end: 9 },
      ]);
      assertTokenInvariants('{{- x -}}');
    });

    // "{% assign x = 'hello' %}" len=24: {%=0..2, text=2..22, %}=22..24
    it('treats quotes as plain text inside Liquid tag context', () => {
      const source = "{% assign x = 'hello' %}";
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.LiquidTagOpen, start: 0, end: 2 },
        { type: TokenType.Text, start: 2, end: 22 },
        { type: TokenType.LiquidTagClose, start: 22, end: 24 },
      ]);
      assertTokenInvariants(source);
    });

    // "{{}}" len=4: {{=0..2, }}=2..4
    it('tokenizes empty Liquid drop {{}}', () => {
      const result = tokens('{{}}');
      expect(result).toMatchObject([
        { type: TokenType.LiquidVariableOutputOpen, start: 0, end: 2 },
        { type: TokenType.LiquidVariableOutputClose, start: 2, end: 4 },
      ]);
      assertTokenInvariants('{{}}');
    });

    // "{%%}" len=4: {%=0..2, %}=2..4
    it('tokenizes empty Liquid tag {%%}', () => {
      const result = tokens('{%%}');
      expect(result).toMatchObject([
        { type: TokenType.LiquidTagOpen, start: 0, end: 2 },
        { type: TokenType.LiquidTagClose, start: 2, end: 4 },
      ]);
      assertTokenInvariants('{%%}');
    });

    // "{{ x }}{{ y }}" len=14: 0:{ 1:{ 2:  3:x 4:  5:} 6:} 7:{ 8:{ 9:  10:y 11:  12:} 13:}
    it('tokenizes adjacent drops with no gap', () => {
      const source = '{{ x }}{{ y }}';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.LiquidVariableOutputOpen, start: 0, end: 2 },
        { type: TokenType.Text, start: 2, end: 5 },
        { type: TokenType.LiquidVariableOutputClose, start: 5, end: 7 },
        { type: TokenType.LiquidVariableOutputOpen, start: 7, end: 9 },
        { type: TokenType.Text, start: 9, end: 12 },
        { type: TokenType.LiquidVariableOutputClose, start: 12, end: 14 },
      ]);
      assertTokenInvariants(source);
    });
  });

  describe('basic HTML tokens', () => {
    it('tokenizes <div>', () => {
      const result = tokens('<div>');
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 4 },
        { type: TokenType.HtmlTagClose, start: 4, end: 5 },
      ]);
      assertTokenInvariants('<div>');
    });

    it('tokenizes </div>', () => {
      const result = tokens('</div>');
      expect(result).toMatchObject([
        { type: TokenType.HtmlCloseTagOpen, start: 0, end: 2 },
        { type: TokenType.Text, start: 2, end: 5 },
        { type: TokenType.HtmlTagClose, start: 5, end: 6 },
      ]);
      assertTokenInvariants('</div>');
    });

    it('tokenizes <br/>', () => {
      const result = tokens('<br/>');
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 3 },
        { type: TokenType.HtmlSelfClose, start: 3, end: 5 },
      ]);
      assertTokenInvariants('<br/>');
    });

    it('tokenizes <br />', () => {
      const result = tokens('<br />');
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 4 },
        { type: TokenType.HtmlSelfClose, start: 4, end: 6 },
      ]);
      assertTokenInvariants('<br />');
    });

    // "<!-- comment -->" len=16: 0:< 1:! 2:- 3:- 4:  5:c ... 11:t 12:  13:- 14:- 15:>
    it('tokenizes <!-- comment -->', () => {
      const result = tokens('<!-- comment -->');
      expect(result).toMatchObject([
        { type: TokenType.HtmlCommentOpen, start: 0, end: 4 },
        { type: TokenType.Text, start: 4, end: 13 },
        { type: TokenType.HtmlCommentClose, start: 13, end: 16 },
      ]);
      assertTokenInvariants('<!-- comment -->');
    });

    it('tokenizes <!DOCTYPE html>', () => {
      const result = tokens('<!DOCTYPE html>');
      expect(result).toMatchObject([
        { type: TokenType.HtmlDoctypeOpen, start: 0, end: 2 },
        { type: TokenType.Text, start: 2, end: 14 },
        { type: TokenType.HtmlTagClose, start: 14, end: 15 },
      ]);
      assertTokenInvariants('<!DOCTYPE html>');
    });
  });

  describe('HTML tag context (modal)', () => {
    // "<div class="foo">" len=17: 0:< 1:d 2:i 3:v 4:  5:c 6:l 7:a 8:s 9:s 10:= 11:" 12:f 13:o 14:o 15:" 16:>
    it('tokenizes <div class="foo">', () => {
      const source = '<div class="foo">';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 10 },
        { type: TokenType.HtmlEquals, start: 10, end: 11 },
        { type: TokenType.HtmlQuoteOpen, start: 11, end: 12 },
        { type: TokenType.Text, start: 12, end: 15 },
        { type: TokenType.HtmlQuoteClose, start: 15, end: 16 },
        { type: TokenType.HtmlTagClose, start: 16, end: 17 },
      ]);
      assertTokenInvariants(source);
    });

    // "<div class='foo'>" len=17: same positions
    it("tokenizes <div class='foo'>", () => {
      const source = "<div class='foo'>";
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 10 },
        { type: TokenType.HtmlEquals, start: 10, end: 11 },
        { type: TokenType.HtmlQuoteOpen, start: 11, end: 12 },
        { type: TokenType.Text, start: 12, end: 15 },
        { type: TokenType.HtmlQuoteClose, start: 15, end: 16 },
        { type: TokenType.HtmlTagClose, start: 16, end: 17 },
      ]);
      assertTokenInvariants(source);
    });

    // "<div class=foo>" len=15: 0:< 1:d...9:s 10:= 11:f 12:o 13:o 14:>
    it('tokenizes unquoted attribute <div class=foo>', () => {
      const source = '<div class=foo>';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 10 },
        { type: TokenType.HtmlEquals, start: 10, end: 11 },
        { type: TokenType.Text, start: 11, end: 14 },
        { type: TokenType.HtmlTagClose, start: 14, end: 15 },
      ]);
      assertTokenInvariants(source);
    });

    it('tokenizes boolean attribute <img disabled>', () => {
      const source = '<img disabled>';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 13 },
        { type: TokenType.HtmlTagClose, start: 13, end: 14 },
      ]);
      assertTokenInvariants(source);
    });

    // '<div id="a" class="b">' len=22
    // 0:< 1:d 2:i 3:v 4:  5:i 6:d 7:= 8:" 9:a 10:" 11:  12:c 13:l 14:a 15:s 16:s 17:= 18:" 19:b 20:" 21:>
    it('tokenizes multiple attributes <div id="a" class="b">', () => {
      const source = '<div id="a" class="b">';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 7 },
        { type: TokenType.HtmlEquals, start: 7, end: 8 },
        { type: TokenType.HtmlQuoteOpen, start: 8, end: 9 },
        { type: TokenType.Text, start: 9, end: 10 },
        { type: TokenType.HtmlQuoteClose, start: 10, end: 11 },
        { type: TokenType.Text, start: 11, end: 17 },
        { type: TokenType.HtmlEquals, start: 17, end: 18 },
        { type: TokenType.HtmlQuoteOpen, start: 18, end: 19 },
        { type: TokenType.Text, start: 19, end: 20 },
        { type: TokenType.HtmlQuoteClose, start: 20, end: 21 },
        { type: TokenType.HtmlTagClose, start: 21, end: 22 },
      ]);
      assertTokenInvariants(source);
    });
  });

  describe('Liquid inside HTML attributes', () => {
    // '<div class="{{ x }}">' len=21
    // 0:< 1:d 2:i 3:v 4:  5:c 6:l 7:a 8:s 9:s 10:= 11:" 12:{ 13:{ 14:  15:x 16:  17:} 18:} 19:" 20:>
    it('tokenizes Liquid drop inside quoted attribute value', () => {
      const source = '<div class="{{ x }}">';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 10 },
        { type: TokenType.HtmlEquals, start: 10, end: 11 },
        { type: TokenType.HtmlQuoteOpen, start: 11, end: 12 },
        { type: TokenType.LiquidVariableOutputOpen, start: 12, end: 14 },
        { type: TokenType.Text, start: 14, end: 17 },
        { type: TokenType.LiquidVariableOutputClose, start: 17, end: 19 },
        { type: TokenType.HtmlQuoteClose, start: 19, end: 20 },
        { type: TokenType.HtmlTagClose, start: 20, end: 21 },
      ]);
      assertTokenInvariants(source);
    });

    // '<div class="a {{ x }} b">' len=25
    // 0:< 1:d 2:i 3:v 4:  5:c 6:l 7:a 8:s 9:s 10:= 11:" 12:a 13:  14:{ 15:{ 16:  17:x 18:  19:} 20:} 21:  22:b 23:" 24:>
    it('tokenizes text before and after Liquid inside quoted value', () => {
      const source = '<div class="a {{ x }} b">';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 10 },
        { type: TokenType.HtmlEquals, start: 10, end: 11 },
        { type: TokenType.HtmlQuoteOpen, start: 11, end: 12 },
        { type: TokenType.Text, start: 12, end: 14 },
        { type: TokenType.LiquidVariableOutputOpen, start: 14, end: 16 },
        { type: TokenType.Text, start: 16, end: 19 },
        { type: TokenType.LiquidVariableOutputClose, start: 19, end: 21 },
        { type: TokenType.Text, start: 21, end: 23 },
        { type: TokenType.HtmlQuoteClose, start: 23, end: 24 },
        { type: TokenType.HtmlTagClose, start: 24, end: 25 },
      ]);
      assertTokenInvariants(source);
    });

    // '<div {% if c %}class="a"{% endif %}>' len=36
    // 0:< 1:d 2:i 3:v 4:  5:{ 6:% 7:  8:i 9:f 10:  11:c 12:  13:% 14:}
    // 15:c 16:l 17:a 18:s 19:s 20:= 21:" 22:a 23:" 24:{ 25:% 26:  27:e 28:n 29:d 30:i 31:f 32:  33:% 34:} 35:>
    it('tokenizes Liquid tag in HTML tag attribute area', () => {
      const source = '<div {% if c %}class="a"{% endif %}>';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 5 },
        { type: TokenType.LiquidTagOpen, start: 5, end: 7 },
        { type: TokenType.Text, start: 7, end: 13 },
        { type: TokenType.LiquidTagClose, start: 13, end: 15 },
        { type: TokenType.Text, start: 15, end: 20 },
        { type: TokenType.HtmlEquals, start: 20, end: 21 },
        { type: TokenType.HtmlQuoteOpen, start: 21, end: 22 },
        { type: TokenType.Text, start: 22, end: 23 },
        { type: TokenType.HtmlQuoteClose, start: 23, end: 24 },
        { type: TokenType.LiquidTagOpen, start: 24, end: 26 },
        { type: TokenType.Text, start: 26, end: 33 },
        { type: TokenType.LiquidTagClose, start: 33, end: 35 },
        { type: TokenType.HtmlTagClose, start: 35, end: 36 },
      ]);
      assertTokenInvariants(source);
    });

    // '<div class="{% if c %}a{% endif %}">' len=36
    // 0:< 1:d 2:i 3:v 4:  5:c 6:l 7:a 8:s 9:s 10:= 11:"
    // 12:{ 13:% 14:  15:i 16:f 17:  18:c 19:  20:% 21:}
    // 22:a
    // 23:{ 24:% 25:  26:e 27:n 28:d 29:i 30:f 31:  32:% 33:}
    // 34:" 35:>
    it('tokenizes Liquid tag inside quoted attribute value', () => {
      const source = '<div class="{% if c %}a{% endif %}">';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.Text, start: 1, end: 10 },
        { type: TokenType.HtmlEquals, start: 10, end: 11 },
        { type: TokenType.HtmlQuoteOpen, start: 11, end: 12 },
        { type: TokenType.LiquidTagOpen, start: 12, end: 14 },
        { type: TokenType.Text, start: 14, end: 20 },
        { type: TokenType.LiquidTagClose, start: 20, end: 22 },
        { type: TokenType.Text, start: 22, end: 23 },
        { type: TokenType.LiquidTagOpen, start: 23, end: 25 },
        { type: TokenType.Text, start: 25, end: 32 },
        { type: TokenType.LiquidTagClose, start: 32, end: 34 },
        { type: TokenType.HtmlQuoteClose, start: 34, end: 35 },
        { type: TokenType.HtmlTagClose, start: 35, end: 36 },
      ]);
      assertTokenInvariants(source);
    });
  });

  describe('compound names', () => {
    // "<{{ type }}>" len=12: 0:< 1:{ 2:{ 3:  4:t 5:y 6:p 7:e 8:  9:} 10:} 11:>
    it('tokenizes <{{ type }}>', () => {
      const source = '<{{ type }}>';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.LiquidVariableOutputOpen, start: 1, end: 3 },
        { type: TokenType.Text, start: 3, end: 9 },
        { type: TokenType.LiquidVariableOutputClose, start: 9, end: 11 },
        { type: TokenType.HtmlTagClose, start: 11, end: 12 },
      ]);
      assertTokenInvariants(source);
    });

    // "<{{ type }}--header>" len=20
    // 0:< 1:{ 2:{ 3:  4:t 5:y 6:p 7:e 8:  9:} 10:} 11:- 12:- 13:h ... 18:r 19:>
    it('tokenizes <{{ type }}--header>', () => {
      const source = '<{{ type }}--header>';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.HtmlTagOpen, start: 0, end: 1 },
        { type: TokenType.LiquidVariableOutputOpen, start: 1, end: 3 },
        { type: TokenType.Text, start: 3, end: 9 },
        { type: TokenType.LiquidVariableOutputClose, start: 9, end: 11 },
        { type: TokenType.Text, start: 11, end: 19 },
        { type: TokenType.HtmlTagClose, start: 19, end: 20 },
      ]);
      assertTokenInvariants(source);
    });
  });

  describe('YAML frontmatter', () => {
    // "---\ntitle: foo\n---\ncontent" len=26
    // 0:- 1:- 2:- 3:\n 4:t...13:o 14:\n 15:- 16:- 17:- 18:\n 19:c...25:t
    // Frontmatter: ---\n...---\n = 0..19 (includes trailing \n)
    it('tokenizes frontmatter at position 0', () => {
      const source = '---\ntitle: foo\n---\ncontent';
      const result = tokens(source);
      expect(result[0].type).toBe(TokenType.YamlFrontmatter);
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(19);
      expect(result[1]).toMatchObject({ type: TokenType.Text, start: 19 });
      assertTokenInvariants(source);
    });

    it('does not tokenize --- when not at position 0', () => {
      const source = 'text\n---\nstuff\n---';
      const result = tokens(source);
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 18 }]);
      assertTokenInvariants(source);
    });
  });

  describe('edge cases', () => {
    it('tokenizes empty document as just EndOfInput', () => {
      const result = tokenize('');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: TokenType.EndOfInput,
        start: 0,
        end: 0,
      });
      assertTokenInvariants('');
    });

    it('tokenizes whitespace-only as Text + EndOfInput', () => {
      const result = tokens('   ');
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 3 }]);
      assertTokenInvariants('   ');
    });

    it('treats < not followed by letter or { as text', () => {
      const source = '1 < 2';
      const result = tokens(source);
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 5 }]);
      assertTokenInvariants(source);
    });

    it('treats lone { as text', () => {
      const source = 'a { b }';
      const result = tokens(source);
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 7 }]);
      assertTokenInvariants(source);
    });

    // "hello {{ x }} world" len=19
    // 0:h...4:o 5:  6:{ 7:{ 8:  9:x 10:  11:} 12:} 13:  14:w...18:d
    it('tokenizes text around a Liquid drop', () => {
      const source = 'hello {{ x }} world';
      const result = tokens(source);
      expect(result).toMatchObject([
        { type: TokenType.Text, start: 0, end: 6 },
        { type: TokenType.LiquidVariableOutputOpen, start: 6, end: 8 },
        { type: TokenType.Text, start: 8, end: 11 },
        { type: TokenType.LiquidVariableOutputClose, start: 11, end: 13 },
        { type: TokenType.Text, start: 13, end: 19 },
      ]);
      assertTokenInvariants(source);
    });

    it('treats > outside tag context as text', () => {
      const source = '>';
      const result = tokens(source);
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 1 }]);
      assertTokenInvariants(source);
    });

    it('treats = outside tag context as text', () => {
      const source = '=';
      const result = tokens(source);
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 1 }]);
      assertTokenInvariants(source);
    });

    it('treats " outside tag context as text', () => {
      const source = '"';
      const result = tokens(source);
      expect(result).toMatchObject([{ type: TokenType.Text, start: 0, end: 1 }]);
      assertTokenInvariants(source);
    });

    it('treats < followed by { as HtmlTagOpen (compound tags)', () => {
      const source = '<{';
      const result = tokens(source);
      expect(result[0]).toMatchObject({ type: TokenType.HtmlTagOpen, start: 0, end: 1 });
      assertTokenInvariants(source);
    });
  });

  describe('structural invariants', () => {
    const cases = [
      '{{ x }}',
      '{% if %}',
      '{%- tag -%}',
      '{{- x -}}',
      "{% assign x = 'hello' %}",
      '{{}}',
      '{%%}',
      '{{ x }}{{ y }}',
      '<div>',
      '</div>',
      '<br/>',
      '<br />',
      '<!-- comment -->',
      '<!DOCTYPE html>',
      '<div class="foo">',
      "<div class='foo'>",
      '<div class=foo>',
      '<img disabled>',
      '<div id="a" class="b">',
      '<div class="{{ x }}">',
      '<div class="a {{ x }} b">',
      '<div {% if c %}class="a"{% endif %}>',
      '<div class="{% if c %}a{% endif %}">',
      '<{{ type }}>',
      '<{{ type }}--header>',
      '---\ntitle: foo\n---\ncontent',
      'text\n---\nstuff\n---',
      '',
      '   ',
      '1 < 2',
      'a { b }',
      'hello {{ x }} world',
      '>',
      '=',
      '"',
    ];

    for (const source of cases) {
      it(`invariants hold for: ${JSON.stringify(source).slice(0, 60)}`, () => {
        assertTokenInvariants(source);
      });
    }
  });
});
