**> **Warning**
>
> This package is open source but not open to contributions. It comes with little documentation but can serve as an example implementation of LSP features on the web.

# CodeMirror Language Client

[CodeMirror](https://codemirror.net/) is the open source library that powers the [Online Store Code Editor](https://shopify.dev/docs/themes/tools/code-editor).

The [Language Server Protocol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) empowers developers to write one language server that can run in all language clients. Write a client, and you gain access to all servers; write one server, and all clients can use it.

This repo serves as a CodeMirror Language Client. Feed it a Language Server and receive the following code editing features:

- [x] Diagnostics (aka Linting)
- [x] Completions
- [x] Hover
- [ ] Document Links
- [ ] Workspace Edits (aka Refactorings, Quickfix, etc.)

## Usage

```typescript
import { CodeMirrorLanguageClient } from '@shopify/codemirror-language-client';

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

