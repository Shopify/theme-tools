---
'@shopify/theme-check-node': minor
---

Add `ThemeCheckConfigError` so configuration-resolution failures are catchable by type.

`loadConfig` now wraps any failure while reading, parsing, or validating a Theme Check
configuration in a `ThemeCheckConfigError`. The error attaches the `configPath` and preserves
the underlying error (filesystem error, YAML parse error, validation error, etc.) on `cause`,
so callers can recognize a configuration problem with a single `instanceof` check — or the
stable `code` (`'THEME_CHECK_CONFIG_ERROR'`) — instead of matching error messages, while the
original error's details remain available on `cause`.
