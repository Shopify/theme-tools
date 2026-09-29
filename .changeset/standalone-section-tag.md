---
'@shopify/liquid-html-parser': patch
'@shopify/theme-check-common': patch
---

Parse `section` as a standalone tag. Removes the hybrid block form, whose forward scan for `{% endsection %}` made files with many `section` tags parse in quadratic time.
