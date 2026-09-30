---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Guide theme blocks to the implicit `content` parameter.

Add the recommended `BlockContentUsage` warning for `block.content` in `blocks/*.liquid`. Its message is "Use the implicit 'content' parameter directly instead of 'block.content'."

Add the recommended `ValidBlockContentSettingType` error for a theme block schema setting named `content` whose Liquid type is not `string`. This error replaces the `ValidBlockArgumentTypes` warning for the same schema declaration.

`UndefinedObject` accepts bare `content` in `blocks/*.liquid`.
