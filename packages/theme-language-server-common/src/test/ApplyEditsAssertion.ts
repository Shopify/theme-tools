import { RawMatcherFn } from '@vitest/expect';
import { TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

interface CustomMatchers<R = unknown> {
  applyEdits: (source: string | TextDocument, expected: string) => R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<TextEdit | TextEdit[]> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export const applyEdits: RawMatcherFn = (
  received: TextEdit | TextEdit[],
  source: TextDocument | string,
  expected: string,
) => {
  const textDocument =
    typeof source === 'string'
      ? TextDocument.create('file:///file.liquid', 'liquid', 1, source.replace('█', ''))
      : source;
  const actual = TextDocument.applyEdits(
    textDocument,
    Array.isArray(received) ? received : [received],
  );
  return {
    message: () => `expected following edit[1] to change source[2] to equal expected[3]
[1]: ${JSON.stringify(received, null, 2)}
[2]: ${textDocument.getText()}
[3]: ${expected}`,
    pass: actual === expected,
  };
};
