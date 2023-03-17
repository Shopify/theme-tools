import { startServer } from '@shopify/liquid-language-server-browser';

startServer(self as any as Worker);

export {};
