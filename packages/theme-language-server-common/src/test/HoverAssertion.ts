import { AsyncExpectationResult, MatcherState, RawMatcherFn } from '@vitest/expect';
import { HoverParams, MarkupContent } from 'vscode-languageserver-protocol';
import { HoverProvider } from '../hover';

interface CustomMatchers<R = unknown> {
  hover(context: string, expected: null | string): Promise<R>;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export const hover: RawMatcherFn<MatcherState> = async function (
  this: MatcherState,
  provider: HoverProvider,
  context: string,
  expected: any,
): AsyncExpectationResult {
  const { isNot, equals, utils } = this;

  const { documentManager } = provider;
  const cursorPosition = context.indexOf('█');

  if (cursorPosition === -1) {
    return {
      pass: false,
      message: () => 'Expected to find "█" in context string to represent cursor position',
    };
  }

  const textDocumentUri = 'file:///file.liquid';
  documentManager.open(textDocumentUri, context.replace(/█/g, ''), 0);
  const textDocument = documentManager.get(textDocumentUri)!.textDocument;
  const params: HoverParams = {
    position: textDocument.positionAt(cursorPosition),
    textDocument: {
      uri: textDocumentUri,
    },
  };

  const result = await provider.hover(params);

  const isExpectingNull = expected === null;
  if (isExpectingNull) {
    return {
      pass: result === expected,
      message: () => `expected hover to ${isNot ? 'not ' : ''}be null`,
      actual: result,
      expected: expected,
    };
  }

  return {
    pass: equals(result, {
      contents: {
        kind: 'markdown',
        value: expected,
      },
    }),
    message: () =>
      `expected hover to${isNot ? ' not' : ''} match value ${utils.printExpected(
        expected,
      )}\ncontext:\n${context}`,
    actual: result === null ? result : (result.contents as MarkupContent).value,
    expected: expected,
  };
};
