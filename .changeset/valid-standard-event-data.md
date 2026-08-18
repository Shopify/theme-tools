---
'@shopify/theme-check-common': minor
---

Add `ValidStandardEventData` check to error on invalid arguments to the `standard_event_data` filter.

The filter's argument values are currently only validated at render time. This check catches invalid literal values statically: `view` is the only supported event type, and `context:` must be one of `page`, `search`, `collection`, `dialog`, or `recommendation`.

Values that aren't string literals are left alone, since the type of the piped input isn't statically knowable.
