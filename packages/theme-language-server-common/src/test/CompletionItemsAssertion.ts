import { CompletionItem, Position } from 'vscode-languageserver-protocol';
import { CompletionsProvider } from '../completions';
import { expect } from 'vitest';
import { AsyncExpectationResult, MatcherState, RawMatcherFn } from '@vitest/expect';

export type CompleteContext = { relativePath: string; source: string };

interface CustomMatchers<R = unknown> {
  /**
   * @param source {string | CompleteContext} - the source to complete
   * @param completionItem {CompletionItem[] | string[]} - the list of completion items or labels
   *
   * @example
   * expect(provider).to.complete("{% end", ["endcomment"])
   * expect(provider).to.complete({ source: "{% end", relativePath: 'sections/foo.liquid' }, ["endcomment"])
   */
  complete(
    source: string | CompleteContext,
    completionItem: Partial<CompletionItem>[] | string[],
  ): Promise<void>;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export const complete: RawMatcherFn<MatcherState> = async function (
  this: MatcherState,
  provider: CompletionsProvider,
  context: string | CompleteContext,
  expected: any[],
): AsyncExpectationResult {
  const { isNot, equals, utils } = this;
  const completeContext = asCompleteContextObject(context);
  const source = createSourceCode(completeContext);
  const completionParams = createCompletionParams(completeContext);
  provider.documentManager.open(completionParams.textDocument.uri, source, 1);
  const result = await provider.completions(completionParams);

  return {
    pass:
      result.length === expected.length &&
      expected.every((expectation, i) =>
        equals(
          result[i],
          typeof expectation === 'string'
            ? expect.objectContaining({
                label: expectation,
              })
            : expectation,
        ),
      ),
    message: () =>
      `expected complete to${isNot ? ' not' : ''} match value ${utils.printExpected(
        expected,
      )}\ncontext:\n${context}`,
    actual: result,
    expected: expected,
  };
};

function asCompleteContextObject(context: string | CompleteContext): CompleteContext {
  if (typeof context === 'string') return { source: context, relativePath: 'file.liquid' };
  return context;
}

function createSourceCode(context: CompleteContext) {
  const regex = new RegExp('█', 'g');
  return context.source.replace(regex, '');
}

function createCompletionParams(context: CompleteContext) {
  const position = createPosition(context.source);
  const textDocument = { uri: `/path/to/${context.relativePath}` };

  return {
    position,
    textDocument,
  };
}

function createPosition(context: string): Position {
  const index = context.indexOf('█');
  const lines = context.substring(0, index === -1 ? context.length : index).split('\n');
  const line = lines.length - 1;
  const character = lines[line].length;

  return { line, character };
}
