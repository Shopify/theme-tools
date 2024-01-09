import { expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as prettier from 'prettier';
import plugin from '../plugin';
import { parse } from '../parser';
import { preprocess } from '../printer/print-preprocess';
import { DocumentNode, LiquidParserOptions } from '../types';

const PARAGRAPH_SPLITTER = /(?:\r?\n){2,}(?=\/\/|It|When|If|focus|debug|skip|<)/i;

const TEST_MESSAGE = /^(\/\/|It|When|If|focus|debug|skip)((\s|\S)(?!<)(?!{)(?!---))*./i;

function testMessage(input: string, actual: string, itMessage: string) {
  return [
    itMessage,
    '########## INPUT',
    input.trimEnd(),
    '########## ACTUAL',
    actual.trimEnd(),
    '##########',
    '',
  ]
    .join('\n')
    .replace(/\n/g, '\n      ')
    .trimEnd();
}

function merge<T, U>(a: T, b: U): T & U {
  return Object.assign({}, a, b);
}

const TEST_IDEMPOTENCE = !!(
  process.env.TEST_IDEMPOTENCE && JSON.parse(process.env.TEST_IDEMPOTENCE)
);

export async function assertFormattedEqualsFixed(
  dirname: string,
  options: Partial<LiquidParserOptions> = {},
) {
  const source = readFile(dirname, 'index.liquid');
  const expectedResults = readFile(dirname, 'fixed.liquid');
  const trimEnd = (s: string) => s.trimEnd();

  const chunks = source.split(PARAGRAPH_SPLITTER).map(trimEnd);
  const expectedChunks = expectedResults.split(PARAGRAPH_SPLITTER).map(trimEnd);
  const testConfigs: ReturnType<typeof getTestSetup>[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const src = chunks[i];
    testConfigs.push(getTestSetup(src, i, expectedChunks[i]));
  }

  let runnableConfigs = testConfigs.filter((x) => !x.skip);
  if (runnableConfigs.find((x) => x.focus || x.debug)) {
    runnableConfigs = runnableConfigs.filter((x) => x.focus || x.debug);
  }

  for (const testConfig of runnableConfigs) {
    const { sourceParagraph, expectedParagraph } = testConfig;
    const testOptions = merge(options, testConfig.prettierOptions);
    const input = sourceParagraph.replace(TEST_MESSAGE, '').trimStart();
    if (testConfig.debug) await debug(input, testOptions);
    let actual = (await format(input, testOptions)).trimEnd();
    let expected = expectedParagraph.replace(TEST_MESSAGE, '').trimStart();

    if (TEST_IDEMPOTENCE) {
      if (testConfig.debug) await debug(actual, testOptions);
      actual = (await format(actual, testOptions)).trimEnd();
    }

    try {
      expect(actual, testMessage(input, actual, testConfig.message)).to.eql(expected);
    } catch (e) {
      // Improve the stack trace so that it points to the fixed file instead
      // of this test-helper file. Might make navigation smoother.
      if ((e as any).stack as any) {
        const fixedUrl = path.join(dirname, 'fixed.liquid');
        const inputUrl = path.join(dirname, 'index.liquid');
        const testUrl = path.join(dirname, 'index.spec.ts');
        const fixedOffset = lineOffset(expectedResults, expected);
        const fixedLoc = diffLoc(expected, actual, fixedOffset).join(':');
        const inputLine = lineOffset(source, sourceParagraph) + 1;
        (e as any).stack = ((e as any).stack as string).replace(
          /^(\s+)at Context.test \(.*:\d+:\d+\)/im,
          [
            `$1at fixed.liquid (${fixedUrl}:${fixedLoc})`,
            `$1at input.liquid (${inputUrl}:${inputLine}:0)`,
            `$1at assertFormattedEqualsFixed (${testUrl}:5:6)`,
          ].join('\n'),
        );
      }

      throw e;
    }
  }
}

// prefix your tests with `debug` so that only this test runs and starts a debugging session
// prefix your tests with `focus` so that only this test runs.
// prefix your tests with `skip` so that it shows up as skipped.
function getTestSetup(sourceParagraph: string, index: number, expectedParagraph: string) {
  let testMessage = TEST_MESSAGE.exec(sourceParagraph) || [
    `it should format as expected (chunk ${index})`,
  ];

  const message = testMessage[0]
    .replace(/^\/\/\s*/, '')
    .replace(/\r?\n/g, ' ')
    .trimEnd()
    .replace(/\.$/, '');
  const prettierOptions: Partial<LiquidParserOptions> = {
    printWidth: 80, // We changed the default, but the tests were written with 80 in mind.
    indentSchema: true, // We changed the default, but the tests were written with true in mind.
    trailingComma: 'es5', // prettier 3 changed the default from "es5" to "all", but our tests were written for prettier 2
  };
  const optionsParser = /(?<name>\w+): (?<value>[^\s]*)/g;
  let match: RegExpExecArray;
  while ((match = optionsParser.exec(message)!) !== null) {
    prettierOptions[match.groups!.name as keyof LiquidParserOptions] = JSON.parse(
      match.groups!.value,
    );
  }

  return {
    sourceParagraph,
    expectedParagraph,
    message: message.replace(optionsParser, '').trimEnd(),
    prettierOptions,
    focus: /^focus/i.test(message),
    debug: /^debug/i.test(message),
    skip: /^skip/i.test(message),
  };
}

function lineOffset(source: string, needle: string): number {
  return (source.slice(0, source.indexOf(needle)).match(/\n/g) || []).length;
}

function diffLoc(expected: string, actual: string, offset: number) {
  // assumes there's a diff.
  let line = 1;
  let col = 0;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] === '\n') {
      line += 1;
      col = 0;
    }
    col += 1;
    if (expected[i] !== actual[i]) break;
  }
  return [offset + line, col];
}

export function readFile(dirname: string, filename: string) {
  return fs.readFileSync(path.join(dirname, filename), 'utf8');
}

export function writeFile(dirname: string, filename: string, contents: string) {
  return fs.writeFileSync(path.join(dirname, filename), contents, 'utf8');
}

export async function format(content: string, options: any) {
  return prettier.format(content, {
    ...options,
    parser: 'liquid-html',
    plugins: [plugin],
  });
}

export function printToDoc(content: string, options: any = {}) {
  return (prettier as any).__debug.printToDoc(content, {
    ...options,
    parser: 'liquid-html',
    plugins: [plugin],
  });
}

export async function debug(content: string, options: any = {}) {
  const ast = parse(content);
  const processedAST = preprocess(ast as any as DocumentNode, options);
  const printed = await format(content, options);
  const doc = printToDoc(content, options);
  debugger;
}

/**
 * Lets you write "magic" string literals that are "reindented" similar to Ruby's <<~
 * So you can write
 *
 * const input = reindent`
 *   function() {
 *     foo();
 *   }
 * `;
 *
 * And it will be as though function() was at indent 0 and foo was indent 1.
 */
export function reindent(strs: TemplateStringsArray, ...keys: any[]): string {
  const s = strs.reduce((acc, next, i) => {
    if (keys[i] !== undefined) {
      return acc + next + keys[i];
    }
    return acc + next;
  }, '');
  const lines = s.replace(/^\r?\n|\s+$/g, '').split(/\r?\n/);
  const minIndentLevel = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^\s*/) as any)[0].length)
    .reduce((a, b) => Math.min(a, b), Infinity);

  if (minIndentLevel === Infinity) {
    return lines.join('\n');
  }

  const indentStrip = ' '.repeat(minIndentLevel);
  return lines
    .map((line) => line.replace(indentStrip, ''))
    .map((s) => s.trimEnd())
    .join('\n');
}
