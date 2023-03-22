<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  Liquid Language Server
  <br>
</h1>

<a href="https://buildkite.com/shopify/liquid-language-server"><img src="https://badge.buildkite.com/6bf30fa49aa5caf63d4033a6dd125b2d0dd158097f185e20ef.svg" alt="Build status"></a>

The [Language Server Protocol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) empowers developers to write one language server that can run in all language clients. Write a client, and you gain access to all servers; write one server, and all clients can use it.

This repo serves as a runtime-agnostic Liquid Language Server.

It contains three modules:

- [`@shopify/liquid-language-server-common`](/packages/common) [![Latest version of '@shopify/liquid-language-server-common' @ Cloudsmith](https://api-prd.cloudsmith.io/v1/badges/version/shopify/node/npm/@shopify/liquid-language-server-common/latest/x/?render=true&show_latest=true&badge_token=gAAAAABkGuuWbRVUicN59-Kiv7PW8PbXzmXYetTZbR5_-wRCHNk62Usni1ukxrViWi8b79jBY1bwA58FVaPFGyIwHvFN3eQGKmTdzdkWHYkvb5EIyxytObw%3D)](https://cloudsmith.io/~shopify/repos/node/packages/detail/npm/@shopify%252Fliquid-language-server-common/latest/) — Runtime agnostic code that can run in browser or Node.js.
- [`@shopify/liquid-language-server-browser`](/packages/browser) [![Latest version of '@shopify/liquid-language-server-browser' @ Cloudsmith](https://api-prd.cloudsmith.io/v1/badges/version/shopify/node/npm/@shopify/liquid-language-server-browser/latest/x/?render=true&show_latest=true&badge_token=gAAAAABkGuuSycifBU7pyUAwQd4wIEPH3sSskeaLI90LBXlkXKpdtgRobotAY_eFui5KgbgWzAWXcdE9aFRO8oiRyrE6s1MeFKfMxhUtU2DdQsEQ23yW2ZE%3D)](https://cloudsmith.io/~shopify/repos/node/packages/detail/npm/@shopify%252Fliquid-language-server-browser/latest/) — Browser specific wrapper over the common library.
- [`@shopify/liquid-language-server-node`](/packages/node) [![Latest version of '@shopify/liquid-language-server-node' @ Cloudsmith](https://api-prd.cloudsmith.io/v1/badges/version/shopify/node/npm/@shopify/liquid-language-server-node/latest/x/?render=true&show_latest=true&badge_token=gAAAAABkGuuWRDRheUGS_E7x5JQCijZ78_jAaVG4Ccoo5lNuNnJfD3ZRzdtKYldqv7NMJmqDPgio7D1WZrNkWZTQdRcOJX7jXD1ylItsmVNidJX_Sb5gfAY%3D)](https://cloudsmith.io/~shopify/repos/node/packages/detail/npm/@shopify%252Fliquid-language-server-node/latest/) — Node.js specific wrapper over the common library.

## Usage

This repo only contains the library over the functionality.

### Node

The Node.js version comes with batteries included and uses <a href="https://en.wikipedia.org/wiki/Standard_streams#Standard_input_(stdin)">STDIN</a> and <a href="https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)">STDOUT</a> as the communication channel.

```typescript
import { startServer } from '@shopify/liquid-language-server-node';

startServer();
```

### Browser

The browser version accepts a [Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) as argument.

```typescript
// worker.ts
import { starServer } from '@shopify/liquid-language-server-browser';

// In a Web Worker, the self object refers to the worker.
startServer(self as any as Worker);
```

## Learn more

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

