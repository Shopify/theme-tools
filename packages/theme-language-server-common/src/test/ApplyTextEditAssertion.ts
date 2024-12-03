import { RawMatcherFn } from '@vitest/expect';
import { TextEdit } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

interface CustomMatchers<R = unknown> {
  applyTextEdit: (source: string, expected: string) => R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<TextEdit> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export const applyTextEdit: RawMatcherFn = (
  received: TextEdit,
  source: string,
  expected: string,
) => {
  const textDocument = TextDocument.create(
    'file:///file.liquid',
    'liquid',
    1,
    source.replace('█', ''),
  );
  const actual = TextDocument.applyEdits(textDocument, [received]);
  return {
    message: () => `expected ${received} to change source to equal ${expected}`,
    pass: actual === expected,
  };
};
