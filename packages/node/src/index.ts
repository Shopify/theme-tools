import { startServer as startCoreServer } from '@shopify/liquid-language-server-common';
import { createConnection } from 'vscode-languageserver/node';
import { stdin, stdout } from 'node:process';

export function startServer() {
  const connection = createConnection(stdin, stdout);

  startCoreServer(connection, {
    // Using console.error to not interfere with messages sent on STDIN/OUT
    log: (message: string) => console.error(message),
    debounce,
  });
}

function debounce<F extends Function>(
  fn: F,
  milliseconds = 1000,
): (...args: ArgumentTypes<F>) => void {
  let timeoutId: NodeJS.Timeout | undefined;

  return (...args) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, milliseconds);
  };
}

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any
  ? A
  : never;
