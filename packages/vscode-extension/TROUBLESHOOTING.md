## I am not seeing completions or linting errors

First we need to make sure that you have a running version of the language server.

1. In your `settings.json` add the following to enable language server logging in the OUTPUT tab:

  ```
  "shopifyLiquid.trace.server": "verbose",
  ```

2. Restart the language server from the command palette (`cmd+p` > `Liquid Theme Check: Restart Server`):

  ![](https://screenshot.click/09-56-qevq9-2pj6g.png)

3. From the OUTPUT tab, select `Theme Check Language Server`:

  ![](https://screenshot.click/09-59-2e99n-v1g30.png)

4. You should see logs, search for `serverInfo` in the logs (`cmd+f` + `serverInfo`)

  ![](https://screenshot.click/09-01-n2w5k-f5kj1.png)

5. We expect either the path to your `shopify` CLI or the path to `theme-check-language-server` on your machine.

   If you don't see that, either you did not install it or we can't find it (presumably because of a problem with you `$PATH` environment variable).

   When that happens, try hardcoding _**ONE**_ of the two following `settings.json` configuration:

    - `"shopifyLiquid.languageServerPath"` the path to the `theme-check-language-server` executable.
    - OR `"shopifyLiquid.shopifyCLIPath"`, the path to the `shopify` CLI.

  **Note:** If you are on Windows, you'd find the path with the `where` command, also note that JSON requires escaping backslashes in paths.

  **Note:** If you are on Linux/macOS, you should be able to find it with the `which` command
