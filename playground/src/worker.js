import { startServer } from '../../packages/browser/standalone';

console.log('[WORKER] hello worker!');

self.addEventListener('message', ({ data: message }) => {
  console.log('[WORKER] message!');
  if (message.method === 'initialize') {
    self.postMessage({
      id: message.id,
      result: {
        capabilities: {},
        serverInfo: {
          name: 'liquid-language-server',
          version: '0.0.1',
        },
      },
    });
  } else {
    console.error(`Don't know how to handle message`, message);
  }
});
