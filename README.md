<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  CodeMirror Language Client
  <br>
</h1>

<p align="center">
  <a href="https://cloudsmith.io/~shopify/repos/node/packages/detail/npm/@shopify%252Fliquid-language-server-browser/1.1.0/"><img src="https://api-prd.cloudsmith.io/v1/badges/version/shopify/node/npm/@shopify/liquid-language-server-browser/1.1.0/x/?render=true&badge_token=gAAAAABkGaRnk3p4aG7P5qwpNZfD5o8fzU8gR7Rk5WpEnvA7NklmJz71niiLBG15sF0spMs3ZVwF4rUcBrkM7cVx1VuxVlRaLarA6jqdiSb0DBzfFtJPRsM%3D" alt="This version of '@shopify/liquid-language-server-browser' @ Cloudsmith" /></a>
  <a href="https://buildkite.com/shopify/code-mirror-language-client"><img src="https://badge.buildkite.com/7691c1730f5c62151a8c4ae39d21a70cabaa30582f599f7287.svg" alt="Build status"></a>
</p>

[CodeMirror](https://codemirror.net/) is the open source library that powers the Online Store Code Editor in [online-store-web](https://github.com/Shopify/online-store-web).

The [Language Server Protocol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) empowers developers to write one language server that can run in all language clients. Write a client, and you gain access to all servers; write one server, and all clients can use it.

This repo serves as a CodeMirror Language Client. Feed it a Language Server and receive the following code editing features:

- [x] [Diagnostics]() (aka Linting)
- [ ] Completions
- [ ] Workspace Edits (aka Refactorings, Quickfix, etc.)

## Usage

```typescript
import { CodeMirrorLanguageClient } from '@shopify/code-mirror-language-client';

async function main() {
  // This doesn't have to be liquid-language-server, it
  // theoretically could be tsserver.
  const worker = new Worker(
    new URL('./language-server-worker.ts', import.meta.url),
  );

  // This is how you instantiate it
  const client = new CodeMirrorLanguageClient(worker);
  await client.start();

  // Demo junk to be replaced
  const filePath = 'browser///input.liquid';

  // Here we add the client.extension for the file path.
  new EditorView({
    state: EditorState.create({
      doc: exampleTemplate,
      extensions: [
        /* ... */
        client.extension(filePath),
      ],
    }),
    parent: document.getElementById('editor')!,
  });
}

main();
```

## Development

1. In a terminal tab, run the TypeScript watcher for the `language-client`.

   ```bash
   yarn dev:client
   ```

2. [Optional] In a different terminal tab, run the playground development server. You can use this to see a trimmed down version of the server/client interactions in action.

   ```bash
   yarn dev:playground
   ```

## Testing

Testings are done with [mocha](https://mochajs.org/) and [chai](https://www.chaijs.com/guide/styles/#expect) because they run really fast.

Run tests with this command:

```
yarn test
```

Or use the recommended VS Code extensions to debug/run the tests.

## Learn more

- Read the [CodeMirror System Guide](https://codemirror.net/docs/guide/) a couple of times.

  The concepts are hard to grok but the time is well spent.

- Read the [Language Server Protocol Spec](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)

  It's important to understand the following concepts:

    - Language Client
    - Language Server
    - Messages
      - Requests / Response
      - Notifications
      - Message direction
    - Client Capabilities
    - Server Capabilities
    - TextDocument synchronization
    - Lifecycle methods

-  Take a look at the `vscode-languageserver-*` libraries offered by VS Code.

   They have `vscode` in their name, but only `vscode-languageclient` is VS Code specific, the other libraries can be used in non-VS Code contexts (we do this here).

   -  [`vscode-languageserver-protocol`](https://github.com/microsoft/vscode-languageserver-node/tree/main/protocol)

      This library is useful to reuse and type check message parameter types.

      Examples: `PublishDiagnosticsNotification`, `DiagnosticClientCapabilities`, `DiagnosticServerCapabilities`, etc.

   -  [`vscode-languageserver-types`](https://github.com/microsoft/vscode-languageserver-node/tree/main/types)

      This library is useful to get the types of specific parts of the Protocol. 

      Examples: `Diagnostic`, `URI`, `TextDocument`, `Position`, `Range`, `LocationLink`, etc.

