> **Warning**
>
> This package is a prototype.

# @shopify/lang-jsonc

CodeMirror 6 Language Support for VS Code's flavour of JSON with Comments. Trailing commas included.

## Usage

```js
import { basicSetup } from 'codemirror';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { jsonc } from '@shopify/lang-jsonc';

new EditorView({
  parent: document.getElementById('json-editor'),
  state: EditorState.create({
    doc: `
      {
        // this is a comment
        "product": "Apple",

        /* block comment, with trailing comma */
        "price": "1.00$",
      }
    `
    extensions: [
      basicSetup,
      jsonc(),
    ],
  }),
});
```

## License

MIT.
