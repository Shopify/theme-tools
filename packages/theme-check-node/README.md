# `@shopify/theme-check-node`

This is the Node.js wrapper of the runtime-agnostic [`@shopify/theme-check-common`](https://npm.im/@shopify/theme-check-common) package. It comes with batteries included.

See the [@shopify/theme-check-common README](../theme-check-common) for more details.

## Custom checks and trusted code

Custom checks execute JavaScript with the permissions of the process running Theme Check. They are disabled by default, including modules listed in a config's `require`, inherited configurations, and automatically discovered `theme-check-*` packages. Built-in checks continue to run, and a warning is written to stderr when custom code is skipped unless the caller provides a diagnostic handler.

Applications that intentionally run trusted custom checks must provide `authorizeCustomChecks` in the options argument:

```ts
import { check, loadConfig, themeCheckRun } from '@shopify/theme-check-node';

// Grant this capability only after the caller has established trust in the theme
// and its custom checks. Do not derive it from files inside the lint target.
const options = { authorizeCustomChecks: () => true };
const offenses = await check(trustedThemeRoot, undefined, options);
const config = await loadConfig(undefined, trustedThemeRoot, options);
const result = await themeCheckRun(trustedThemeRoot, undefined, console.error, options);
```

The same options are accepted by `checkAndAutofix` and `getThemeAndConfig`. The callback receives `{ root, candidates }`, where each candidate has a `path` and a `source` (`require` or `discovery`). It runs before any custom module is evaluated. Only an explicit `true` response enables execution; an omitted callback or any other response keeps custom checks disabled. Callback errors stop config loading.

Applications can also provide `onDiagnostic` in the same options to handle skipped-check notices. The callback receives a typed diagnostic with `code: 'custom-checks-disabled'`, `level: 'warning'`, `message`, `root`, and `candidates`. It replaces the default stderr output for that notice, so callers can display it in a summary, emit a structured event, or use their own logger. Diagnostic handling does not authorize custom checks, and no skipped-check diagnostic is emitted when checks are approved or no custom checks are found.

An explicitly supplied config path also requires authorization. Package names, absolute paths, and relative paths can all resolve to theme-controlled code, so changing the path format does not establish trust. Authorization permits ordinary Node module execution, including imported dependencies; it is not a JavaScript sandbox or an approval of exact file contents.

## License

MIT.
