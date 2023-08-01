import path from 'node:path';

const pipe = (value: any, ...fns: any[]) => fns.reduce((val: any, fn: any) => fn(val), value);

export const thisNodeModuleRoot = pipe(
  require.resolve('@shopify/theme-check-common/package.json'),
  path.dirname, // @shopify
  path.dirname, // node_modules
  path.dirname, // root of node_modules
);
