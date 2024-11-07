import { Format } from '../common/formatter';
import LiquidPrettierPlugin from '@shopify/prettier-plugin-liquid';
import babelPrettierPlugin from 'prettier/parser-babel';
import * as prettier from 'prettier/standalone';

export const vscodePrettierFormat: Format = async (textDocument) => {
  // In browser, we don't have access to the file system nor can we run arbitrary node code
  // We do like the web version of the prettier plugin, we don't support configs at all.
  // See [1] for more information.
  // [1]: https://prettier.io/docs/en/browser
  const text = textDocument.getText();
  return prettier.format(text, {
    parser: 'liquid-html',
    plugins: [LiquidPrettierPlugin as any, babelPrettierPlugin as any],
  });
};
