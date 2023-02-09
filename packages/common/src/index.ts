import { Connection, InitializeResult } from 'vscode-languageserver';

// Inject "boundary" stuff
// But what is it?
// - Filesystem
// - Formatter
// - The way it was built
export function startServer(connection: Connection) {
  connection.onInitialize((_params) => {
    const result: InitializeResult = {
      capabilities: {},
      serverInfo: {
        name: 'liquid-language-server',
        version: '0.0.1',
      },
    };
    return result;
  });

  connection.listen();
}
