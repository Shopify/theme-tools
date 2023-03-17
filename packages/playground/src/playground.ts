import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { liquid, liquidHighLightStyle } from '@shopify/lang-liquid';

import { CodeMirrorLanguageClient } from '@shopify/code-mirror-language-client';

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

async function main() {
  const worker = new Worker(
    new URL('./language-server-worker.ts', import.meta.url),
  );

  const client = new CodeMirrorLanguageClient(worker);
  await client.start();

  new EditorView({
    state: EditorState.create({
      doc: exampleTemplate,
      extensions: [
        liquid(),
        liquidHighLightStyle,
        oneDark,
        client.extension('browser///input.liquid'),
      ],
    }),
    parent: document.getElementById('editor')!,
  });
}

main();
