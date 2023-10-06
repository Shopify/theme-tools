import { expect } from 'vitest';
import { AsyncExpectationResult, MatcherState, RawMatcherFn } from '@vitest/expect';
import { HoverParams, MarkupContent } from 'vscode-languageserver-protocol';
import { HoverProvider } from '../hover';

interface CustomMatchers<R = unknown> {
  hover(context: string | HoverContext, expected: null | string): Promise<R>;
}

export type HoverContext = {
  source: string;
  relativePath: string;
};

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export const hover: RawMatcherFn<MatcherState> = async function (
  this: MatcherState,
  provider: HoverProvider,
  context: string | HoverContext,
  expected: any,
): AsyncExpectationResult {
  const { isNot, equals, utils } = this;
  const hoverContext = asHoverContext(context);
  const { source, relativePath } = hoverContext;

  const { documentManager } = provider;
  const cursorPosition = source.indexOf('█');

  if (cursorPosition === -1) {
    return {
      pass: false,
      message: () => 'Expected to find "█" in context string to represent cursor position',
    };
  }

  const textDocumentUri = `file:///${relativePath}`;
  documentManager.open(textDocumentUri, source.replace(/█/g, ''), 0);
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
    pass: equals(
      result,
      expect.objectContaining({
        contents: {
          kind: 'markdown',
          value: expected,
        },
      }),
    ),
    message: () =>
      `expected hover to${isNot ? ' not' : ''} match value ${utils.printExpected(
        expected,
      )}\ncontext:\n${context}`,
    actual: result === null ? result : (result.contents as MarkupContent).value,
    expected: expected,
  };
};

function asHoverContext(context: string | HoverContext): HoverContext {
  if (typeof context === 'string') return { source: context, relativePath: 'file.liquid' };
  return context;
}
