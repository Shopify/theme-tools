import { startServer as startCoreServer } from '@shopify/liquid-language-server-common';
import { createConnection } from 'vscode-languageserver/node';
import { stdin, stdout } from 'node:process';

export function startServer() {
  const connection = createConnection(stdin, stdout);

  startCoreServer(connection, {
    // Using console.error to not interfere with messages sent on STDIN/OUT
    log: (message: string) => console.error(message),
  });
}

