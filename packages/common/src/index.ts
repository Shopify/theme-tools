import { Connection, InitializeResult } from 'vscode-languageserver';

interface Dependencies {
  log?(message: string): void;
}

const defaultLogger = () => {};

/**
 * This code runs in node and the browser, it can't talk to the file system
 * or make requests. Stuff like that should be injected.
 */
export function startServer(
  connection: Connection,
  { log = defaultLogger }: Dependencies = {},
) {
  log('wooot')
  connection.onInitialize((params) => {
    log(
      `[SERVER] Received initialize request with params:\n ${JSON.stringify(
        params,
        null,
        2,
      )}`,
    );
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
