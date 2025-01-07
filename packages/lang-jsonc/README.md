# @shopify/lang-jsonc

[CodeMirror](https://codemirror.net/) 6 Language Support for VS Code's flavour of JSON with Comments. Trailing commas included.

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

## Credits

This project includes code from the following repositories. Thank you for your work!

1. [@yettoapp/jsonc](https://github.com/yettoapp/lezer-jsonc)
2. [@lezer/json](https://github.com/lezer-parser/json)
3. [@codemirror/lang-json](https://github.com/codemirror/lang-json)

See [ThirdPartyNotices.txt](../../ThirdPartyNotices.txt) for their licenses.

## License

MIT.
