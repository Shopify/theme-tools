import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { jsonc } from '@shopify/lang-jsonc';
import { vim } from '@replit/codemirror-vim';
import MarkdownIt from 'markdown-it';
// import { oneDark } from '@codemirror/theme-one-dark';
// import { liquid, liquidHighLightStyle } from '@shopify/lang-liquid';

import { CodeMirrorLanguageClient } from '@shopify/codemirror-language-client';
import * as SetFileTreeNotification from './SetFileTreeNotification';
import * as SetDefaultTranslationsNotification from './SetDefaultTranslationsNotification';
import { MarkedString, MarkupContent } from 'vscode-languageserver-protocol';

const md = new MarkdownIt();

const exampleTemplate = `{% # sections/title.liquid %}
{% # mod-alt-v for vim mode %}
<section>
  <h2>{{ section.settings.title }}</h2>
  {% echo 'hi' | upcase %}
</section>

{% schema %}
{
  "name": "t:sections.title.name",
  "limit": 1,
  "settings": [
    {
      "type": "text",
      "id": "title",
      "label": "t:sections.title.settings.title.label"
    }
  ]
}
{% endschema %}
`;

const exampleTranslations = {
  product: {
    price_html: '<b>{{ price }}$</b>',
    size: 'Size',
    count: {
      one: '{{ count }} item',
      other: '{{ count }} items',
    },
  },
  footer: {
    subscribe: 'Subscribe to our newsletter',
  },
};

function asMarkdown(content: MarkupContent | MarkedString[] | MarkedString): string {
  if (Array.isArray(content)) {
    return content.map((c) => asMarkdown(c)).join('\n');
  }

  if (typeof content === 'string') {
    return content;
  }

  if (MarkupContent.is(content)) {
    return content.value;
  }

  if (!content) {
    return '';
  }

  return `\`\`\`${content.language}\n${content.value}\n\`\`\``;
}

let vimEnabled = false;
const vimCompartment = new Compartment();

async function main() {
  const worker = new Worker(new URL('./language-server-worker.ts', import.meta.url));

  const client = new CodeMirrorLanguageClient(
    worker,
    {},
    {
      autocompleteOptions: {
        activateOnTyping: true,
        maxRenderedOptions: 20,
        defaultKeymap: true,
      },
      infoRenderer: (completionItem) => {
        if (!completionItem.documentation || typeof completionItem.documentation === 'string') {
          return null;
        }
        const node = document.createElement('div');
        const htmlString = md.render(completionItem.documentation.value);
        node.innerHTML = htmlString;
        return node;
      },
      hoverRenderer: (_, hover) => {
        const node = document.createElement('div');
        const htmlString = md.render(asMarkdown(hover.contents));
        node.innerHTML = htmlString;
        return {
          dom: node,
        };
      },
    },
  );

  await client.start();

  // Mock "main-thread-provided" value for the filetree
  worker.postMessage({
    jsonrpc: '2.0',
    method: SetFileTreeNotification.method,
    params: [
      '/snippets/article-card.liquid',
      '/snippets/product-card.liquid',
      '/snippets/product.liquid',
    ],
  } as SetFileTreeNotification.type);

  // Mock "main-thread-provided" value for the default translations
  worker.postMessage({
    jsonrpc: '2.0',
    method: SetDefaultTranslationsNotification.method,
    params: exampleTranslations,
  } as SetDefaultTranslationsNotification.type);

  const vimConfig = [
    vimCompartment.of([]),
    keymap.of([
      {
        key: 'Mod-Alt-v',
        run: () => {
          [liquidEditor, themeTranslationsEditor, schemaTranslationEditor].forEach((view) => {
            view.dispatch({
              effects: vimCompartment.reconfigure([vimEnabled ? [] : vim({ status: true })]),
            });
          });
          vimEnabled = !vimEnabled;
          return true;
        },
      },
    ]),
  ];

  const liquidEditor = new EditorView({
    state: EditorState.create({
      doc: exampleTemplate,
      extensions: [
        vimConfig,
        basicSetup,
        // liquid(),
        // liquidHighLightStyle,
        // oneDark,
        client.extension('browser:/sections/section.liquid'),
      ],
    }),
    parent: document.getElementById('liquid-editor')!,
  });

  const themeTranslationsEditor = new EditorView({
    state: EditorState.create({
      doc: JSON.stringify(exampleTranslations, null, 2),
      extensions: [
        vimConfig,
        basicSetup,
        jsonc(),
        // oneDark,
        client.extension('browser:/locales/en.default.json'),
      ],
    }),
    parent: document.getElementById('theme-translations-editor')!,
  });

  const schemaTranslationEditor = new EditorView({
    state: EditorState.create({
      doc: JSON.stringify(
        {
          sections: {
            title: {
              name: 'Title section name',
              settings: { title: { label: 'Title section title setting' } },
            },
            other: {
              name: 'Other section name',
            },
          },
        },
        null,
        2,
      ),
      extensions: [
        vimConfig,
        basicSetup,
        jsonc(),
        // liquidHighLightStyle,
        // oneDark,
        client.extension('browser:/locales/en.default.schema.json'),
      ],
    }),
    parent: document.getElementById('schema-translations-editor')!,
  });
}

main();
