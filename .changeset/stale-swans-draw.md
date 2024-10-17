---
'@shopify/theme-language-server-browser': major
'@shopify/theme-language-server-node': major
---

Expose language server connection in Public API

This lets you send non-standard LSP messages to the client.

```ts
import { getConnection, startServer, AbstractFileSystem } from '@shopify/theme-language-server-browser'

class MainThreadFileSystem implements AbstractFileSystem {
  constructor(private connection) {}
  readFile(uri) { return this.connection.sendRequest('fs/readFile', uri); }
  readDirectory(uri) { return this.connection.sendRequest('fs/readDirectory', uri); }
  readFile(uri) { return this.connection.sendRequest('fs/stat', uri); }
}

const worker = self as any as Worker;
const connection = getConnection(worker);
const fs = new MainThreadFileSystem(connection);
const dependencies = { /* ... */ };

startServer(worker, dependencies, connection);
```
