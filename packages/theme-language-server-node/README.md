# `@shopify/theme-language-server-node`

This is the Node.js wrapper of the runtime-agnostic [`@shopify/theme-language-server-node`](https://npm.im/@shopify/theme-language-server-common) package. It comes with batteries included.

See the [@shopify/theme-language-server-common README](../theme-language-server-common) for more details.

## Custom check authorization

The server runs built-in checks by default. To enable trusted custom checks, pass the [Node authorization options](../theme-check-node#custom-checks-and-trusted-code) as the third argument of `startServer`:

```ts
import { startServer } from '@shopify/theme-language-server-node';

startServer(undefined, undefined, {
  authorizeCustomChecks: async ({ root, candidates }) => {
    return requestPermissionFromUser(root, candidates);
  },
});
```

The embedding application owns the permission decision. An LSP client request by itself does not enable custom code; the application must supply the authorization callback.

## License

MIT.
