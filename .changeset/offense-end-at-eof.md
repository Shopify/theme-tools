---
'@shopify/theme-check-common': patch
---

Fix the line and character of an offense that ends at the end of a file. They were one character short, or on the previous line when the file ends with a newline.
