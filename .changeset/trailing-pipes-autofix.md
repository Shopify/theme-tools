---
'@shopify/theme-check-common': patch
---

Fix the autofix for a filter chain that ends in several pipes (`{{ x | upcase | | }}`): LiquidHTMLSyntaxError now reports one trailing-pipe offense that removes them all, instead of two overlapping fixes that couldn't be applied together.
