import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import MarkdownIt from 'markdown-it';
// import { oneDark } from '@codemirror/theme-one-dark';
// import { liquid, liquidHighLightStyle } from '@shopify/lang-liquid';

import { CodeMirrorLanguageClient } from '@shopify/codemirror-language-client';
import * as SetFileTreeNotification from './SetFileTreeNotification';
import * as SetDefaultTranslationsNotification from './SetDefaultTranslationsNotification';
import { MarkedString, MarkupContent } from 'vscode-languageserver-protocol';

const md = new MarkdownIt();

const exampleTemplate = `<!doctype html>
<html class="no-js" lang="{{ request.locale.iso_code }}">
  <head>
    {{ 'theme.js' | asset_url | script_tag }}
    {{ content_for_header }}
  </head>

  <body class="gradient">
    {{ content_for_layout }}
  </body>
</html>`;

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

  return `\`\`\`${content.language}\n${content.value}\n\`\`\``;
}

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

  new EditorView({
    state: EditorState.create({
      doc: exampleTemplate,
      extensions: [
        basicSetup,
        // liquid(),
        // liquidHighLightStyle,
        // oneDark,
        client.extension('browser:/input.liquid'),
      ],
    }),
    parent: document.getElementById('liquid-editor')!,
  });

  new EditorView({
    state: EditorState.create({
      doc: JSON.stringify(exampleTranslations, null, 2),
      extensions: [
        basicSetup,
        json(),
        // liquidHighLightStyle,
        // oneDark,
        client.extension('browser:/locales/en.default.json'),
      ],
    }),
    parent: document.getElementById('json-editor')!,
  });
}

main();
