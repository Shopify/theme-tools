import { startServer } from '@shopify/liquid-language-server-node';

startServer();

process.on('uncaughtException', (e) => {
  console.error(e);
  debugger;
});

process.on('unhandledRejection', (e) => {
  console.error(e);
});
