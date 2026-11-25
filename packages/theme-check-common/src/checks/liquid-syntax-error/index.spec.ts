import { describe, it, expect } from 'vitest';
import { runLiquidCheck } from '../../test';
import { LiquidSyntaxError } from './index';
import { checkBlockParserError } from './block';
import { isDocParserError } from './doc';
import { checkJavascriptParserError } from './javascript';
import { checkPartialParserError } from './partial';
import { checkRawParserError } from './raw';
import { hasRubyAcceptedWhitespaceSeparatedQuotePrefix, liquidLineTagLocation } from './utils';

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
  describe('quote detection parity', () => {
    it('classifies Ruby-accepted quote prefixes with tokenizer coverage', () => {
      expect(hasRubyAcceptedWhitespaceSeparatedQuotePrefix("' ")).toBe(true);
      expect(hasRubyAcceptedWhitespaceSeparatedQuotePrefix("'")).toBe(false);
      expect(hasRubyAcceptedWhitespaceSeparatedQuotePrefix("' foo ")).toBe(false);
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
  });

  describe('doc tags', () => {
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

  describe('raw tags', () => {
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
  });

  describe('javascript tags', () => {
    it('accepts javascript closing markup in parser-error handling', () => {
      const reports: { message: string }[] = [];

      checkJavascriptParserError(
        new Error(UNCLOSED_JAVASCRIPT_PARSER_ERROR),
        { report: (offense: any) => reports.push(offense) } as never,
        "{% javascript %}console.log('x');{% endjavascript foo %}",
      );

      expect(reports).toEqual([]);
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
});
