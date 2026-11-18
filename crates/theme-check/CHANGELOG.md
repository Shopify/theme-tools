# theme-check-rs

## 0.1.3

### Patch Changes

- ede4d4fc: `liquid-parser` parses block tags glued to an HTML tag name (`<a{% if x %}{% endif %}…>`) in time linear in the length of the name. Before, each glued block with an empty body looked ahead to the end of the HTML tag again, so the parse time grew with the square of the number of such blocks. The parsed trees are unchanged.
- f8e75c0b: Checks that look up a theme file by a name from theme content (`MissingAsset`, `ValidStaticBlockType`, `JSONMissingSection`, `MissingTemplate`, `JSONMissingBlock`, `ValidBlockTarget`, `AssetSizeJavaScript` and `AssetSizeCSS`) look only in the directory the path names, such as `assets`, `blocks` or `sections`. A name that leaves that directory, also in its percent-encoded form, now gets the same result whether or not a file exists at that path, and the check does not read the file system for it.

## 0.1.2

### Patch Changes

- 41f11363: Keep app block asset size checks inside the assets directory, matching TypeScript. Reject paths and encoded paths before checking whether a file exists or reading its size.

## 0.1.1

### Patch Changes

- 5c726064: Add `Checker::cancelable`, for a run that stops between files, and `Error::is_cancelled`
- 4a04763c: Add `Checker::ignore`, the files a run leaves out, as in `.theme-check.yml`'s `ignore`
- d1d509d5: Add `Checker::threads`, where 1 checks the files on the calling thread, and resume a check's panic with its own message
