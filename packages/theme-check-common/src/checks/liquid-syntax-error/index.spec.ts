import { describe, it, expect } from 'vitest';
import { runLiquidCheck } from '../../test';
import { LiquidSyntaxError } from './index';
import { checkBlockParserError } from './block';
import { isDocParserError } from './doc';
import { checkJavascriptParserError } from './javascript';
import { checkPartialParserError } from './partial';
import { checkRawParserError } from './raw';
import { hasRubyAcceptedWhitespaceSeparatedQuotePrefix, liquidLineTagLocation } from './utils';

const RENDER_SYNTAX_ERROR = "Syntax error in 'render' tag";
const BARE_BRACKET_ACCESS = 'Bare bracket access is not allowed in strict2 mode';

const UNCLOSED_DOC_PARSER_ERROR = "Attempting to end parsing before LiquidRawTag 'doc' was closed";
const UNOPENED_DOC_PARSER_ERROR =
  "Attempting to close LiquidTag 'doc' before it was opened without a matching 'doc'";
const UNCLOSED_JAVASCRIPT_PARSER_ERROR =
  "Attempting to end parsing before LiquidRawTag 'javascript' was closed";
const UNOPENED_JAVASCRIPT_PARSER_ERROR =
  "Attempting to close LiquidTag 'javascript' before it was opened without a matching 'javascript'";

/*
 * The target harness's `runLiquidCheck` runs only the `LiquidSyntaxError`
 * check, so every returned offense already carries `check: 'LiquidSyntaxError'`.
 * We drive tag-name recognition through the real `builtinTags` fallback in
 * base.ts by passing `themeDocset: undefined` (the harness would otherwise
 * inject a docset whose `tags()` returns `[]`).
 */
const NO_DOCSET = { themeDocset: undefined } as const;

describe('LiquidSyntaxError', () => {
  describe('unknown tags', () => {
    it('does not report unknown tags like {% foobar %}', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% foobar %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('uses injected tag docs for unknown tags inside liquid blocks', async () => {
      const customThemeDocset = {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [{ name: 'custom_tag' }],
        systemTranslations: async () => ({}),
      };

      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% liquid\n  custom_tag\n%}',
        'snippets/test.liquid',
        { themeDocset: customThemeDocset },
      );

      expect(offenses).toEqual([]);
    });

    it('reports unknown tags inside liquid blocks', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% liquid\n  hello world\n%}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Unknown tag 'hello'",
      });
    });
  });

  describe('misplaced branch keywords', () => {
    it.each([
      ['else', '{% else %}', "Unknown tag 'else'"],
      ['when', '{% when x %}', "Unknown tag 'when'"],
      ['when inside if', '{% if true %}{% when x %}{% endif %}', "Unknown tag 'when'"],
      ['when inside for', '{% for x in xs %}{% when x %}{% endfor %}', "Unknown tag 'when'"],
      ['when inside liquid', '{% liquid\n  when x\n%}', "Unknown tag 'when'"],
      ['elsif inside liquid', '{% liquid\n  elsif x\n%}', "Unknown tag 'elsif'"],
    ])('reports misplaced branch keyword %s', async (_name, template, message) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message,
      });
    });

    it.each([
      '{% if true %}{% else %}{% endif %}',
      '{% case x %}{% when x %}{% else %}{% endcase %}',
      '{% for x in xs %}{% else %}{% endfor %}',
    ])('does not report valid else branches in %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });
  });

  describe('inline comment tags', () => {
    it('reports no-space multiline comments without prefixed continuation lines', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% #hello\nworld %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(
        "Syntax error in tag '#' - Each line of comments must be prefixed by the '#' character",
      );
    });

    it('accepts no-space multiline comments with prefixed continuation lines', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% #hello\n#world %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it("accepts Ruby's blank-first-line single-continuation shape", async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% #\nworld %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });
  });

  describe('valid assign tags', () => {
    it('produces no diagnostics for {% assign x = 1 %}', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x = 1 %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it("produces no diagnostics for {% assign x = 'hello' %}", async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% assign x = 'hello' %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for {% assign x = foo.bar %}', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x = foo.bar %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for {% assign x = foo | filter %}', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x = foo | filter %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for {% assign x = %} (empty RHS)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x = %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for {% assign x extra = x %}', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x extra = x %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each(['{% assign "x = y %}', "{% assign 'x = y %}"])(
      'matches Ruby Liquid parity for unclosed assign quote prefix in %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses).toEqual([]);
      },
    );
  });

  describe('invalid assign tags', () => {
    it('reports LiquidSyntaxError for {% assign = 1 %} (missing LHS)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign = 1 %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for {% assign x.y = 1 %} (dotted LHS)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x.y = 1 %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for {% assign !x = 1 %} (garbage before target)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign !x = 1 %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it.each(['{% assign x 42 = x %}', "{% assign x 'hi' = x %}", '{% assign x ? = x %}'])(
      'reports diagnostics for %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBeGreaterThan(0);
      },
    );

    it('reports LiquidSyntaxError for {% assign x = foo | %} (empty filter)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x = foo | %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });
  });

  describe('capture tags', () => {
    it('produces no diagnostics for valid capture tags inside liquid blocks', async () => {
      const template = '{% liquid\n  capture x\n  endcapture\n%}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports LiquidSyntaxError for skipped capture markup inside liquid blocks', async () => {
      const template = '{% liquid\n  capture @x\n  endcapture\n%}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });
  });

  describe('include tags', () => {
    it.each([
      '{% include 42 %}',
      '{% include 3.14 %}',
      '{% include -5 %}',
      '{% include true %}',
      '{% include false %}',
      '{% include nil %}',
      '{% include blank %}',
      '{% include empty %}',
      '{% include (1..5) %}',
    ])('produces no diagnostics for %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports LiquidSyntaxError for {% include ? %}', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% include ? %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for bare bracket access in include bindings', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% include 42 for [0] %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for multipart include named arguments', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% include 42, key.secondkey: value %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });
  });

  describe('empty echo and variable output markup', () => {
    it.each(['{% echo %}', '{% echo    %}', '{{ }}', '{{    }}'])(
      'produces no diagnostics for %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses).toEqual([]);
      },
    );

    it('reports LiquidSyntaxError for garbage-only variable output', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{{ @ }}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe('Syntax error in variable output');
    });
  });

  describe('empty first filter arguments', () => {
    it.each([
      '{{ product.title | append: }}',
      '{% echo product.title | append: %}',
      '{% assign title = product.title | append: %}',
    ])('produces no diagnostics for %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each(['{{ x y | append: }}', '{% echo x y | append: %}', '{% assign a = x y | append: %}'])(
      'reports diagnostics for malformed prefixes in %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
      },
    );

    it.each(['{{ product.title | }}', '{% echo product.title | %}'])(
      'reports diagnostics for %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
      },
    );
  });

  describe('section tags', () => {
    it('produces no diagnostics for section keyword arguments', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% section 'header', color: 'red' %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports LiquidSyntaxError for block-form section tags with body content', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% section 'wrap' %}body{% endsection %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe("Unknown tag 'endsection'");
    });

    it('reports LiquidSyntaxError for empty block-form section tags', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% section 'foo' %}{% endsection %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe("Unknown tag 'endsection'");
    });

    /*
     * Bare bracket access in section keyword argument values is caught by the
     * parser / LiquidHTMLSyntaxError layer, not by the `LiquidSyntaxError`
     * section check. Running `LiquidSyntaxError` alone reports nothing here.
     */
    it('does not report bare bracket section keyword argument values on its own', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% section 'header', foo: [0] %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });
  });

  describe('tablerow tags', () => {
    it('reports LiquidSyntaxError for bare bracket tablerow named argument values', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% tablerow product in collection.products cols: [0] %}{% endtablerow %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('uses injected tag docs to allow known loop arguments', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% tablerow product in collection.products cols: 3 limit: 6 %}{% endtablerow %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });
  });

  describe('trailing comma parity', () => {
    it.each([
      '{% cycle x, %}',
      '{% tablerow product in collection.products, %}{% endtablerow %}',
      '{% paginate collection.products by 12, %}{% endpaginate %}',
    ])('produces no diagnostics for %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each([
      '{% cycle x,, %}',
      '{% cycle x @, %}',
      '{% tablerow product in collection.products,, %}{% endtablerow %}',
      '{% tablerow product in collection.products @, %}{% endtablerow %}',
      '{% paginate collection.products by 12,, %}{% endpaginate %}',
      '{% paginate collection.products by 12 @, %}{% endpaginate %}',
    ])('reports diagnostics for %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBeGreaterThan(0);
    });
  });

  describe('check precedence', () => {
    /*
     * In the target only the `LiquidSyntaxError` check runs, so the world's
     * dual-check dedup no longer applies. The single check emits one offense
     * for the malformed filter on this line.
     */
    it('emits a single LiquidSyntaxError on the same line', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% assign x = foo | %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('keeps one offense per line when errors are on different lines', async () => {
      const template = '{% assign x = foo | %}\n{% assign = 1 %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      const checks = offenses.map((o) => o.check).sort();
      expect(checks).toEqual(['LiquidSyntaxError', 'LiquidSyntaxError']);
    });
  });

  describe('bare bracket access', () => {
    it('reports LiquidSyntaxError for {% case [0] %} (bare bracket in case expression)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% case [0] %}{% when 1 %}{% endcase %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for {% when [0] %} (bare bracket in when value)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% case x %}{% when [0] %}{% endcase %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for {% capture [0] %} (bare bracket in capture tag)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% capture [0] %}{% endcapture %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for {% decrement [0] %} (bare bracket in decrement tag)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% decrement [0] %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('reports LiquidSyntaxError for {{ [0] }} (bare bracket in variable output)', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{{ [0] }}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });
  });

  describe('unless tags', () => {
    it('produces no diagnostics for valid unless conditions', async () => {
      const templates = [
        '{% unless product.available %}Sold out{% endunless %}',
        "{% unless product.available or customer.tags contains 'vip' %}Hidden{% endunless %}",
        '{% unless items[0] %}Empty{% endunless %}',
        '{% unless\n  product.available\n%}Sold out{% endunless %}',
        "{% liquid\n  unless product.available\n    echo 'Sold out'\n  endunless\n%}",
      ];

      for (const template of templates) {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses).toEqual([]);
      }
    });

    it('reports LiquidSyntaxError for skipped unless garbage', async () => {
      const templates = [
        '{% unless product.available @ %}Sold out{% endunless %}',
        '{% unless product.available @ and customer %}Hidden{% endunless %}',
        '{% unless\n  product.available\n  @\n%}Sold out{% endunless %}',
      ];

      for (const template of templates) {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
        expect(offenses[0].check).toBe('LiquidSyntaxError');
        expect(offenses[0].message).toBe("Syntax error in 'unless' tag");
      }
    });

    it('reports LiquidSyntaxError for bare unless bracket access', async () => {
      const template = '{% unless [0] %}Hidden{% endunless %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe('Bare bracket access is not allowed in strict2 mode');
    });

    it('reports LiquidSyntaxError for whitespace-separated unless quote prefixes', async () => {
      const templates = [
        "{% unless ' product.available %}Sold out{% endunless %}",
        '{% unless " product.available %}Sold out{% endunless %}',
      ];

      for (const template of templates) {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
        expect(offenses[0].check).toBe('LiquidSyntaxError');
        expect(offenses[0].message).toBe("Syntax error in 'unless' tag");
      }
    });

    it.each([
      "{% unless 'product.available %}Sold out{% endunless %}",
      '{% unless "product.available %}Sold out{% endunless %}',
    ])('reports LiquidSyntaxError for adjacent unless quote prefixes in %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe("Syntax error in 'unless' tag");
    });
  });

  describe('quote detection parity', () => {
    it('classifies Ruby-accepted quote prefixes with tokenizer coverage', () => {
      expect(hasRubyAcceptedWhitespaceSeparatedQuotePrefix("' ")).toBe(true);
      expect(hasRubyAcceptedWhitespaceSeparatedQuotePrefix("'")).toBe(false);
      expect(hasRubyAcceptedWhitespaceSeparatedQuotePrefix("' foo ")).toBe(false);
    });

    it.each([
      "{% if product.title == 'Hat' %}Hat{% endif %}",
      "{% case product.type %}{% when 'shirt' %}Shirt{% endcase %}",
      "{{ 'hello' }}",
    ])('produces no diagnostics for closed string markup in %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each([
      "{% if ' product.available %}Available{% endif %}",
      "{% case product.type %}{% when ' shirt %}Shirt{% endcase %}",
      "{{ 'hello }}",
    ])('reports LiquidSyntaxError for unclosed string markup in %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBeGreaterThan(0);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });
  });

  describe('block and partial parser errors', () => {
    it('locates line-mode block tags inside liquid blocks', () => {
      expect(liquidLineTagLocation("{% liquid\n  block 'hero'\n%}", 'block')).toEqual([12, 24]);
    });

    it.each([
      {
        tagName: 'block',
        markup: "block 'hero'",
        message: "Unclosed block tag 'block' in {% liquid %} block",
      },
      {
        tagName: 'partial',
        markup: "partial 'product-card'",
        message: "Unclosed block tag 'partial' in {% liquid %} block",
      },
    ])(
      'reports LiquidSyntaxError for unclosed $tagName tags inside liquid blocks',
      async ({ tagName, markup, message }) => {
        const template = `{% liquid\n  ${markup}\n%}`;
        const reports: { message: string; startIndex: number; endIndex: number }[] = [];
        const context = { report: (offense: any) => reports.push(offense) } as never;

        if (tagName === 'block') {
          checkBlockParserError(new Error(message), context, template);
        } else {
          checkPartialParserError(new Error(message), context, template);
        }

        expect(reports).toEqual([
          {
            startIndex: template.indexOf(markup),
            endIndex: template.indexOf(markup) + markup.length,
            message,
          },
        ]);

        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );
        expect(offenses[0]).toMatchObject({
          message,
        });
      },
    );

    it.each([
      {
        tagName: 'block',
        template: '{% endblock %}',
        message:
          "Attempting to close LiquidTag 'block' before it was opened without a matching 'block'",
      },
      {
        tagName: 'partial',
        template: '{% endpartial %}',
        message:
          "Attempting to close LiquidTag 'partial' before it was opened without a matching 'partial'",
      },
    ])(
      'reports LiquidSyntaxError for standalone end$tagName tags',
      async ({ template, message }) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
        expect(offenses[0].message).toBe(message);
      },
    );
  });

  describe('doc tags', () => {
    it('produces no diagnostics for doc closing markup', async () => {
      const template = '{% doc %}content{% enddoc foo %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports later unclosed doc blocks after accepted doc closing markup', async () => {
      const template = '{% doc %}content{% enddoc foo %}{% doc %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Attempting to end parsing before LiquidRawTag 'doc' was closed",
      });
    });

    it('accepts later balanced doc blocks after accepted doc closing markup', async () => {
      const template = '{% doc %}content{% enddoc foo %}{% doc %}later{% enddoc %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for whitespace-control doc closing markup', async () => {
      const template = '{% doc %}content{%- enddoc foo -%}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports nested doc tags with whitespace-control delimiters', async () => {
      const template = '{% doc %}{%- doc -%}{% enddoc %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: 'Nested doc tags are not allowed',
      });
    });

    it('does not treat similarly-prefixed doc tag names as nested doc tags', async () => {
      const template = '{% doc %}{% docx %}{% enddoc %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('does not treat text-only doc mentions as doc parser errors', () => {
      const error = new Error(UNCLOSED_DOC_PARSER_ERROR);

      expect(isDocParserError(error, 'plain doc and enddoc text')).toBe(false);
    });

    it('does not treat similarly-prefixed doc tags as doc parser errors', () => {
      const error = new Error(UNCLOSED_DOC_PARSER_ERROR);

      expect(isDocParserError(error, '{% docx %}')).toBe(false);
    });

    it('treats real doc and enddoc tags as doc parser errors', () => {
      expect(isDocParserError(new Error(UNCLOSED_DOC_PARSER_ERROR), '{% doc %}')).toBe(true);
      expect(isDocParserError(new Error(UNOPENED_DOC_PARSER_ERROR), '{% enddoc %}')).toBe(true);
    });
  });

  describe('comment tags', () => {
    it('reports nested comment blocks masked by a later independent comment block', async () => {
      const template =
        '{% comment %}{% comment %}inner{% endcomment %}{% comment %}second{% endcomment %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Liquid syntax error: 'comment' tag was never closed",
      });
    });

    it('reports nested raw blocks masked by a later independent raw block', async () => {
      const template = '{% comment %}{% raw %}inner{% endcomment %}{% raw %}second{% endraw %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBeGreaterThan(0);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('accepts nested comment and raw blocks closed immediately after the parsed comment closer', async () => {
      const templates = [
        '{% comment %}{% comment %}inner{% endcomment %}{% endcomment %}',
        '{% comment %}{% raw %}{% endcomment %}{% endraw %}{% endcomment %}',
      ];

      for (const template of templates) {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses).toEqual([]);
      }
    });
  });

  describe('raw tags', () => {
    it('produces no diagnostics for Liquid syntax inside a valid raw body', async () => {
      const template = '{% raw %}{% if broken %}{% endraw %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for raw closing markup', async () => {
      const template = '{% raw %}c{% endraw foo %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports later unclosed raw blocks after accepted raw closing markup', async () => {
      const template = '{% raw %}c{% endraw foo %}{% raw %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Attempting to end parsing before LiquidRawTag 'raw' was closed",
      });
    });

    it('accepts later balanced raw blocks after accepted raw closing markup', async () => {
      const template = '{% raw %}c{% endraw foo %}{% raw %}later{% endraw %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for whitespace-control raw closing markup', async () => {
      const template = '{% raw %}c{%- endraw foo -%}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports parser errors for similarly-prefixed raw closing tags', async () => {
      const template = '{% raw %}c{% endrawx foo %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        message: "Attempting to end parsing before LiquidRawTag 'raw' was closed",
      });
    });

    it('reports LiquidSyntaxError for raw opening markup', async () => {
      const template = '{% raw foo %}{% endraw %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Syntax error in 'raw' tag",
        start: { index: template.indexOf('foo') },
        end: { index: template.indexOf('foo') + 'foo'.length },
      });
    });

    it('reports LiquidSyntaxError for skipped raw opening characters', async () => {
      const template = '{% raw @#$ %}{% endraw %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Syntax error in 'raw' tag",
        start: { index: template.indexOf('@#$') },
        end: { index: template.indexOf('@#$') + '@#$'.length },
      });
    });

    it('reports LiquidSyntaxError for quoted raw opening markup', async () => {
      const template = "{% raw 'hello' %}{% endraw %}";
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe("Syntax error in 'raw' tag");
    });

    it('reports LiquidSyntaxError for unclosed quoted raw opening markup', async () => {
      const template = "{% raw 'hello %}{% endraw %}";
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe("Syntax error in 'raw' tag");
    });

    it('reports the raw parser error for unclosed raw tags', () => {
      const reports: { message: string }[] = [];

      checkRawParserError(
        new Error("Attempting to end parsing before LiquidRawTag 'raw' was closed"),
        { report: (offense: any) => reports.push(offense) } as never,
        '{% raw %}',
      );

      expect(reports).toEqual([
        {
          message: "Attempting to end parsing before LiquidRawTag 'raw' was closed",
          startIndex: 0,
          endIndex: '{% raw %}'.length,
        },
      ]);
    });

    it('reports the raw parser error for standalone endraw tags', () => {
      const reports: { message: string }[] = [];

      checkRawParserError(
        new Error(
          "Attempting to close LiquidTag 'raw' before it was opened without a matching 'raw'",
        ),
        { report: (offense: any) => reports.push(offense) } as never,
        '{% endraw %}',
      );

      expect(reports).toEqual([
        {
          message:
            "Attempting to close LiquidTag 'raw' before it was opened without a matching 'raw'",
          startIndex: 0,
          endIndex: '{% endraw %}'.length,
        },
      ]);
    });

    it('reports LiquidSyntaxError for unclosed raw tags inside liquid blocks', async () => {
      const template = '{% liquid\n  raw\n%}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: "Unclosed raw tag 'raw' in {% liquid %} block",
      });
    });

    it('does not report raw parser errors when source text merely mentions raw', async () => {
      const template = 'This text mentions raw and endraw without Liquid tags.';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });
  });

  describe('javascript tags', () => {
    it.each([
      '{% javascript %}{% endjavascript %}',
      '{% javascript    %}{% endjavascript %}',
      '{%- javascript -%}{%- endjavascript -%}',
    ])('produces no diagnostics for empty javascript markup in %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'sections/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each(['{% javascript foo %}{% endjavascript %}', '{% javascript @#$ %}{% endjavascript %}'])(
      'reports LiquidSyntaxError for invalid javascript opening markup: %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'sections/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
        expect(offenses[0]).toMatchObject({
          check: 'LiquidSyntaxError',
          message: "Syntax Error in 'javascript' - Valid syntax: javascript",
        });
      },
    );

    it('does not treat similarly-prefixed javascript tags as javascript openings', async () => {
      const template = '{% javascriptx foo %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('accepts javascript closing markup in parser-error handling', () => {
      const reports: { message: string }[] = [];

      checkJavascriptParserError(
        new Error(UNCLOSED_JAVASCRIPT_PARSER_ERROR),
        { report: (offense: any) => reports.push(offense) } as never,
        "{% javascript %}console.log('x');{% endjavascript foo %}",
      );

      expect(reports).toEqual([]);
    });

    it('produces no diagnostics for javascript closing markup', async () => {
      const template = "{% javascript %}console.log('x');{% endjavascript foo %}";
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'sections/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports parser errors for similarly-prefixed javascript closing tags', async () => {
      const template = "{% javascript %}console.log('x');{% endjavascriptx foo %}";
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        message: "'javascript' tag was never closed",
      });
    });

    it('does not report parser errors when source text merely mentions javascript', () => {
      const reports: { message: string }[] = [];

      checkJavascriptParserError(
        new Error(UNCLOSED_JAVASCRIPT_PARSER_ERROR),
        { report: (offense: any) => reports.push(offense) } as never,
        'plain javascript and endjavascript text',
      );

      expect(reports).toEqual([]);
    });

    it('does not treat similarly-prefixed javascript tags as parser errors', () => {
      const reports: { message: string }[] = [];

      checkJavascriptParserError(
        new Error(UNCLOSED_JAVASCRIPT_PARSER_ERROR),
        { report: (offense: any) => reports.push(offense) } as never,
        '{% javascriptx %}',
      );

      expect(reports).toEqual([]);
    });

    it('treats real javascript and endjavascript tags as parser errors', () => {
      const reports: { message: string }[] = [];

      checkJavascriptParserError(
        new Error(UNCLOSED_JAVASCRIPT_PARSER_ERROR),
        { report: (offense: any) => reports.push(offense) } as never,
        '{% javascript %}',
      );
      checkJavascriptParserError(
        new Error(UNOPENED_JAVASCRIPT_PARSER_ERROR),
        { report: (offense: any) => reports.push(offense) } as never,
        '{% endjavascript %}',
      );

      expect(reports).toEqual([
        {
          message: "'javascript' tag was never closed",
          startIndex: 0,
          endIndex: '{% javascript %}'.length,
        },
        {
          message: "Unknown tag 'endjavascript'",
          startIndex: 0,
          endIndex: '{% endjavascript %}'.length,
        },
      ]);
    });
  });

  describe('style and stylesheet tags', () => {
    it.each(['{% style %}{% endstyle %}', '{% style    %}{% endstyle %}'])(
      'produces no diagnostics for empty style markup in %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses).toEqual([]);
      },
    );

    it('reports LiquidSyntaxError for style arguments', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% style extra %}{% endstyle %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: `'style' tag does not accept any arguments in "extra"`,
      });
    });

    it.each([
      '{% stylesheet %}{% endstylesheet %}',
      '{% stylesheet    %}{% endstylesheet %}',
      "{% stylesheet 'scss' %}{% endstylesheet %}",
    ])('produces no diagnostics for valid stylesheet markup in %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'sections/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each([
      ['{% stylesheet scss %}{% endstylesheet %}', 'scss'],
      ['{% stylesheet scssx %}{% endstylesheet %}', 'scssx'],
      ['{% stylesheet scss extra %}{% endstylesheet %}', 'scss extra'],
      ['{% stylesheet scss? %}{% endstylesheet %}', 'scss?'],
    ])(
      'reports LiquidSyntaxError for invalid stylesheet markup in %s',
      async (template, markup) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'sections/test.liquid',
          NO_DOCSET,
        );

        expect(offenses.length).toBe(1);
        expect(offenses[0]).toMatchObject({
          check: 'LiquidSyntaxError',
          message: `'stylesheet' tag can only accept the string argument 'scss' in "${markup}"`,
        });
      },
    );
  });

  describe('comment tags (raw bodies)', () => {
    it.each([
      '{% comment %}{% comment %}inner{% endcomment %}',
      '{%- comment -%}{%- comment -%}inner{%- endcomment -%}',
      '{% comment %}{% raw %}hello{% endcomment %}',
      '{% comment %}this is {{{ not }}} valid{{ liquid{% endcomment %}',
      '{% comment %}this is {% if liquid{% endcomment %}',
    ])('reports LiquidSyntaxError for Ruby-stricter comment raw bodies: %s', async (template) => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
    });

    it('produces no diagnostics for inert closed Liquid tags inside comment bodies', async () => {
      const template = '{% comment %}{% if %}{% endcomment %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for closed raw tags inside comment bodies', async () => {
      const template = '{% comment %}{% raw %}hello{% endraw %}{% endcomment %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('does not treat similarly-prefixed names as comment or raw tags', async () => {
      const template = '{% comment %}{% commentx %}{% rawx %}{% endcomment %}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('does not report parser errors when source text merely mentions comment tags', async () => {
      const template = 'This text mentions comment and endcomment without Liquid tags.';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it.each([
      '{% comment %}{% comment %}inner{% endcomment %}{% endcomment %}',
      '{% comment %}{% comment %}{% comment %}deep{% endcomment %}{% endcomment %}{% endcomment %}',
      '{% comment %}{% raw %}{% endcomment %}{% endraw %}{% endcomment %}',
      '{%- comment -%}{%- raw -%}{%- endcomment -%}{%- endraw -%}{%- endcomment -%}',
    ])(
      'produces no diagnostics for Ruby-accepted inert comment raw bodies: %s',
      async (template) => {
        const offenses = await runLiquidCheck(
          LiquidSyntaxError,
          template,
          'snippets/test.liquid',
          NO_DOCSET,
        );

        expect(offenses).toEqual([]);
      },
    );
  });

  describe('non-assign valid Liquid', () => {
    it('produces no diagnostics for valid Liquid', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% if true %}hello{% endif %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for Liquid output tags', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{{ shop.name }}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });
  });

  describe('valid render tags', () => {
    it('produces no diagnostics for valid render markup', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% render 'snippet' %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('produces no diagnostics for valid render markup inside liquid blocks', async () => {
      const template = "{% liquid\n  render 'snippet', product: product\n%}";
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses).toEqual([]);
    });

    it('reports LiquidSyntaxError for skipped quote prefixes', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% render \"'snippet' %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(RENDER_SYNTAX_ERROR);
    });
  });

  describe('invalid render tags', () => {
    it('reports LiquidSyntaxError for malformed string markup', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% render %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(RENDER_SYNTAX_ERROR);
    });

    it('reports LiquidSyntaxError for malformed string markup inside liquid blocks', async () => {
      const template = '{% liquid\n  render\n%}';
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(RENDER_SYNTAX_ERROR);
    });

    it('reports LiquidSyntaxError for bare bracket access in render snippet lookups', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        '{% render [0] %}',
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(BARE_BRACKET_ACCESS);
    });

    it('reports LiquidSyntaxError for bare bracket access in render binding values', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% render 'snippet' for [0] %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(BARE_BRACKET_ACCESS);
    });

    it('reports LiquidSyntaxError for bare bracket access in render keyword values', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% render 'snippet', x: [0] %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(BARE_BRACKET_ACCESS);
    });

    it('reports LiquidSyntaxError for skipped trailing garbage in render markup', async () => {
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        "{% render 'snippet' ? %}",
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0].check).toBe('LiquidSyntaxError');
      expect(offenses[0].message).toBe(RENDER_SYNTAX_ERROR);
    });

    it('reports LiquidSyntaxError for skipped trailing garbage inside liquid blocks', async () => {
      const template = "{% liquid\n  render 'snippet' ?\n%}";
      const offenses = await runLiquidCheck(
        LiquidSyntaxError,
        template,
        'snippets/test.liquid',
        NO_DOCSET,
      );

      expect(offenses.length).toBe(1);
      expect(offenses[0]).toMatchObject({
        check: 'LiquidSyntaxError',
        message: RENDER_SYNTAX_ERROR,
        start: { index: template.indexOf('render') },
        end: { index: template.indexOf('?') + '?'.length },
      });
    });
  });
});
