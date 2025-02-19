import { describe, beforeEach, it, expect } from 'vitest';
import { DocumentManager } from '../../documents';
import { CompletionsProvider } from '../CompletionsProvider';
import { MetafieldDefinitionMap, TagEntry } from '@shopify/theme-check-common';
import { InsertTextFormat, InsertTextMode, TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CURSOR } from '../params';

const caseSyntax = `{% case variable %}
  {% when first_value %}
    first_expression
  {% else %}
    second_expression
{% endcase %}`;
const caseSnippetWithInsideStripping = `case \${1:variable} -%}
  {%- when \${2:first_value} -%}
    \$3
  {%- else -%}
    \$4
{%- endcase %}`;
const caseSnippetWithOutsideStripping = `case \${1:variable} %}
  {% when \${2:first_value} %}
    \$3
  {% else %}
    \$4
{% endcase -%}`;
const caseSnippetWithAllTheStripping = `case \${1:variable} -%}
  {%- when \${2:first_value} -%}
    \$3
  {%- else -%}
    \$4
{%- endcase -%}`;
const caseSnippetInsideLiquidTag = `case \${1:variable}
  when \${2:first_value}
    \$3
  else
    \$4
endcase`;

export const tags: TagEntry[] = [
  {
    name: 'render',
    syntax: "{% render 'snippet' %}",
    syntax_keywords: [{ keyword: 'snippet', description: '...' }],
  },
  {
    name: 'for',
    syntax: '{% for item in array) %}body{% endfor %}',
    syntax_keywords: [
      { keyword: 'item', description: '...' },
      { keyword: 'array', description: '...' },
      { keyword: 'body', description: '...' },
    ],
  },
  {
    name: 'case',
    syntax: caseSyntax,
    syntax_keywords: [
      { keyword: 'variable', description: '...' },
      { keyword: 'first_value', description: '...' },
      { keyword: 'first_expression', description: '...' },
      { keyword: 'second_expression', description: '...' },
    ],
  },
  {
    name: 'comment',
    syntax: '{% comment %}comment_body{% endcomment %}',
    syntax_keywords: [{ keyword: 'comment_body', description: '...' }],
  },
  {
    name: 'if',
    syntax: '{% if condition %}\n  expression\n{% endif %}',
    syntax_keywords: [
      { keyword: 'condition', description: '...' },
      { keyword: 'expression', description: '...' },
    ],
  },
  { name: 'echo' },
  {
    name: 'doc',
    syntax: '{% doc %}doc_body{% enddoc %}',
    syntax_keywords: [{ keyword: 'doc_body', description: '...' }],
  },
];

describe('Module: LiquidTagsCompletionProvider', async () => {
  let provider: CompletionsProvider;

  beforeEach(async () => {
    provider = new CompletionsProvider({
      documentManager: new DocumentManager(),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        tags: async () => tags,
        systemTranslations: async () => ({}),
      },
      getMetafieldDefinitions: async (_rootUri: string) => ({} as MetafieldDefinitionMap),
    });
  });

  it('should complete Liquid tags', async () => {
    await expect(provider).to.complete('{% comm', ['comment']);
    await expect(provider).to.complete('{% com', ['comment']);
    await expect(provider).to.complete('{% re', ['render']);
    await expect(provider).to.complete('{% ren', ['render']);
    await expect(provider).to.complete('{% rend', ['render']);
    await expect(provider).to.complete('{% fo', ['for']);
    await expect(provider).to.complete('{% do', ['doc']);
  });

  it('should complete end tags with the correct thing', async () => {
    await expect(provider).to.complete('{% comment %} hello there {% end', ['endcomment']);
    await expect(provider).to.complete('{% if cond %} hello {% else %} then {% end', ['endif']);
    await expect(provider).to.complete('{% for i in (1..3) %}{% end', ['endfor']);
    await expect(provider).to.complete('{% javascript %} console.log("hi") {% end', [
      'endjavascript',
    ]);
    await expect(provider).to.complete('{% form "cart", cart %} ... {% end', ['endform']);
    await expect(provider).to.complete('{% doc %} doc_body {% end', ['enddoc']);
  });

  it('should not complete literal `liquid` tag', async () => {
    await expect(provider).to.complete(
      `{% liquid
        echo 'hello'
        e`,
      ['echo'],
    );

    await expect(provider).not.to.complete(
      `{% liquid
        echo 'hello'
        e`,
      ['endliquid'],
    );
  });

  it('should offer the proper end tags in context', async () => {
    await expect(provider).to.complete('{% comment %} hello there {% e', ['echo', 'endcomment']);
    await expect(provider).to.complete('{% if cond %} hello {% else %} then {% e', [
      'echo',
      'endif',
    ]);
    await expect(provider).to.complete('{% for i in (1..3) %}{% e', ['echo', 'endfor']);
    await expect(provider).to.complete('{% javascript %} console.log("hi") {% e', [
      'echo',
      'endjavascript',
    ]);
    await expect(provider).to.complete('{% form "cart", cart %} ... {% e', ['echo', 'endform']);
    await expect(provider).to.complete('{% doc %} my doc {% e', ['echo', 'enddoc']);
  });

  it('should not complete anything if the partial end tag does not match', async () => {
    await expect(provider).to.complete('{% comment %} hello there {% endz', []);
    await expect(provider).to.complete('{% if cond %} hello {% else %} then {% endz', []);
    await expect(provider).to.complete('{% for i in (1..3) %}{% endz', []);
    await expect(provider).to.complete('{% javascript %} console.log("hi") {% endz', []);
    await expect(provider).to.complete('{% form "cart", cart %} ... {% endz', []);
    await expect(provider).to.complete('{% doc %} my doc {% endz', []);
  });

  it('should complete empty statements', async () => {
    const allTags = tags.map((x) => x.name).sort();
    await expect(provider).to.complete('{% ', allTags);
    await expect(provider).to.complete(
      '{% comment %} hello there {% ',
      allTags.concat('endcomment'),
    );
    await expect(provider).to.complete(
      '{% if cond %} hello {% else %} then {% ',
      allTags.concat('endif'),
    );
    await expect(provider).to.complete('{% for i in (1..3) %}{% ', allTags.concat('endfor'));
    await expect(provider).to.complete(
      '{% javascript %} console.log("hi") {% ',
      allTags.concat('endjavascript'),
    );
    await expect(provider).to.complete(
      '{% form "cart", cart %} ... {% ',
      allTags.concat('endform'),
    );
    await expect(provider).to.complete('{% doc %} my doc {% ', allTags.concat('enddoc'));
  });

  describe('Snippet completion', () => {
    it('should not snippet complete when the tag being completed already has markup in it', async () => {
      const scenarios = [
        '{% if█ a > b %}',
        '{% if█ a > b -%}',
        `{% liquid
           if█ a > b
         %}`,
      ];
      for (const source of scenarios) {
        await expect(provider).to.complete(source, [
          expect.objectContaining({
            label: 'if',
            insertTextFormat: InsertTextFormat.PlainText,
          }),
        ]);
      }
    });

    it('should snippet complete when the tag being completed doesnt have existing markup in it', async () => {
      const scenarios = [
        '{% if█ %}',
        '{% if█ -%}...{% if cond %}{% endif %}',
        '{% if cond %}{% if█ -%}...{% endif %}',
      ];
      for (const scenario of scenarios) {
        await expect(provider).to.complete(scenario, [
          expect.objectContaining({
            label: 'if',
            insertTextFormat: InsertTextFormat.Snippet,
          }),
        ]);
      }
    });

    it('should offer text edits that apply correctly', async () => {
      const source = '...\n{% if█ %}\n...';
      await expect(provider).to.complete(source, [
        expect.objectContaining({
          label: 'if',
          insertTextFormat: InsertTextFormat.Snippet,
          insertTextMode: InsertTextMode.adjustIndentation,
          textEdit: expect.applyEdits(
            source,
            '...\n{% if ${1:condition} %}\n  $2\n{% endif %}\n...',
          ),
        }),
      ]);
    });

    it('should inline the snippet if the tag is inline with more content', async () => {
      await expect(provider).to.complete('<div {% if█ %}>', [
        expect.objectContaining({
          label: 'if',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: 'if ${1:condition} %}$2{% endif %}',
          },
        }),
      ]);
    });

    it('should maintain inside stripping whitespace if present', async () => {
      await expect(provider).to.complete('{% if█ -%}', [
        expect.objectContaining({
          label: 'if',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: 'if ${1:condition} -%}\n  $2\n{%- endif %}',
          },
        }),
      ]);
      await expect(provider).to.complete('{% case█ -%}...', [
        expect.objectContaining({
          label: 'case',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: caseSnippetWithInsideStripping,
          },
        }),
      ]);
    });

    it('should mirror outsite stripping whitespace if present', async () => {
      await expect(provider).to.complete('{%- if█ %}', [
        expect.objectContaining({
          label: 'if',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: 'if ${1:condition} %}\n  $2\n{% endif -%}',
          },
        }),
      ]);
      await expect(provider).to.complete('{%- case█ %}...', [
        expect.objectContaining({
          label: 'case',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: caseSnippetWithOutsideStripping,
          },
        }),
      ]);
    });

    it('should default to the whitespace stripping of the outer bracket', async () => {
      await expect(provider).to.complete('{%- if█', [
        expect.objectContaining({
          label: 'if',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: 'if ${1:condition} -%}\n  $2\n{%- endif -%}',
          },
        }),
      ]);
    });

    it('should strip whitespace everywhere if we can infer that', async () => {
      await expect(provider).to.complete('{%- case█ -%}', [
        expect.objectContaining({
          label: 'case',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: caseSnippetWithAllTheStripping,
          },
        }),
      ]);
    });

    it('should snippet complete non-block tags correctly', async () => {
      await expect(provider).to.complete('{% re█ -%}', [
        expect.objectContaining({
          label: 'render',
          insertTextFormat: InsertTextFormat.Snippet,
          textEdit: {
            range: expect.any(Object),
            newText: "render '$1'$2 -%}",
          },
        }),
      ]);
    });

    describe('inside {% liquid %} tags', () => {
      it('should remove the `{%` and `%}` from the snippet', async () => {
        const source = `
          {% liquid
            if a > b
              █
            endif
          %}`;
        await expect(provider).to.complete(
          source,
          expect.arrayContaining([
            expect.objectContaining({
              label: 'if',
              textEdit: {
                range: expect.any(Object),
                newText: 'if ${1:condition}\n  $2\nendif',
              },
            }),
            expect.objectContaining({
              label: 'render',
              textEdit: {
                range: expect.any(Object),
                newText: "render '$1'$2",
              },
            }),
            expect.objectContaining({
              label: 'case',
              textEdit: {
                range: expect.any(Object),
                newText: caseSnippetInsideLiquidTag,
              },
            }),
          ]),
        );
      });
    });
  });

  it('should not complete when the cursor position is not on the name', async () => {
    await expect(provider).to.complete('{% for i in (1..3)█', []);
    await expect(provider).to.complete('{% for i in (1..3) █', []);
    await expect(provider).to.complete('{% for i in (1..3) %}█', []);
    await expect(provider).to.complete('{% for i in (1..3) %} hi {% endfor %}█', []);
    await expect(provider).to.complete('{% for i in (1..3) %} hi {% endfor %}█', []);
    await expect(provider).to.complete('{% render "snip█', []);
  });

  it('should complete completed tags', async () => {
    await expect(provider).to.complete('{% for█ i in (1..3)', ['for']);
    await expect(provider).to.complete('{% render█ "markup"', ['render']);
  });
});
