import { CompletionItem, Position } from 'vscode-languageserver';
import { CompletionsProvider } from '../completions';

declare global {
  export namespace Chai {
    interface Assertion {
      /**
       * @param source {string} - the source to complete
       * @param message {CompletionItem[] | string[]} - the list of completion items or labels
       *
       * @example
       * expect(provider).to.complete("{% end", ["endcomment"])
       */
      complete(source: string, completionItem: CompletionItem[] | string[]): Promise<void>;
    }
  }
}

export const CompletionItemsAssertion = {
  name: 'complete',
  fn: async function (this: Chai.AssertionPrototype, ...args: any[]) {
    const provider: CompletionsProvider = this._obj;

    const context: string = args.at(0);
    const expected: CompletionItem[] | string[] = args.at(1);
    const source = createSourceCode(context);
    const completionParams = createCompletionParams(context);

    provider.documentManager.open(completionParams.textDocument.uri, source, 1);

    const actual = await provider.completions(completionParams);

    const isEmptyListAssertion = expected.length === 0;
    if (isEmptyListAssertion) {
      emptyListAssertion(this, actual, expected);
      return;
    }

    const isLabelAssertion = typeof expected.at(0) === 'string';
    if (isLabelAssertion) {
      labelAssertion(this, actual, expected);
      return;
    }

    objectAssertion(this, actual, expected);
  },
};

function emptyListAssertion(
  chai: Chai.AssertionPrototype,
  actual: CompletionItem[],
  expected: CompletionItem[] | string[],
) {
  const actualJson = JSON.stringify(actual, null, 2);

  chai.assert(
    expected.length === actual.length,
    `expected ${actualJson} to be empty`,
    `expected ${actualJson} to not be empty`,
    expected,
    actual,
    false, // show diff
  );
}

function labelAssertion(
  chai: Chai.AssertionPrototype,
  actual: CompletionItem[],
  expectedLabels: CompletionItem[] | string[],
) {
  objectAssertion(
    chai,
    actual.map((e) => e.label),
    expectedLabels,
  );
}

function objectAssertion(
  chai: Chai.AssertionPrototype,
  actual: CompletionItem[] | string[],
  expected: CompletionItem[] | string[],
) {
  const actualJson = JSON.stringify(actual, null, 2);
  const expectedJson = JSON.stringify(expected, null, 2);

  chai.assert(
    actualJson === expectedJson,
    `expected ${actualJson} to be ${expectedJson}`,
    `expected ${actualJson} to not be ${expectedJson}`,
    expectedJson,
    actualJson,
    false, // show diff
  );
}

function createSourceCode(context: string) {
  const regex = new RegExp('█', 'g');
  return context.replace(regex, '');
}

function createCompletionParams(context: string) {
  const position = createPosition(context);
  const textDocument = { uri: '/path/to/file.liquid' };

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
