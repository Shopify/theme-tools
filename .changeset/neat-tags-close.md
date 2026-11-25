---
'@shopify/theme-language-server-common': patch
---

Close the newly opened HTML element when typing `>` before an existing parent closing tag, and close `<script>` and `<style>` again. Typing `>` on an element that already has its closing tag inserts nothing.
