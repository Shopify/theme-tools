import { toLiquidAST } from '@shopify/liquid-html-parser';
import { isError } from '../../../utils';

export const INVALID_SYNTAX_MESSAGE = 'Syntax is not supported';

export function ensureValidAst(source: string) {
  try {
    const ast = toLiquidAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    return !isError(ast);
  } catch (_error) {
    return false;
  }
}

export function getValuesInMarkup(markup: string) {
  return [...markup.matchAll(/"[^"]*"|'[^']*'|\S+/g)].map((match) => ({
    value: match[0],
    index: match.index,
  }));
}

// Individual regex patterns
const DOUBLE_QUOTED_STRING = `"[^"]*"`;
const SINGLE_QUOTED_STRING = `'[^']*'`;
const PARENTHESES_GROUP = `\\([^)]*\\)`;
const REGULAR_TOKEN = `[^\\s,|]+`; // tokens separated by commas, spaces, or pipes

// Quoted strings pattern (combination of double and single quoted)
const QUOTED_STRING = `(${DOUBLE_QUOTED_STRING}|${SINGLE_QUOTED_STRING})`;

// Value pattern for key-value pairs (can be quoted, parenthesized, or regular token)
const VALUE_PATTERN = `(${QUOTED_STRING}|${PARENTHESES_GROUP}|${REGULAR_TOKEN})`;

// Key-value pair pattern
const KEY_VALUE_PAIR = `\(\S+):\\s*${VALUE_PATTERN}`;

const MARKUP_FRAGMENTS_PATTERN = new RegExp(
  `${QUOTED_STRING}|${PARENTHESES_GROUP}|${KEY_VALUE_PAIR}|${REGULAR_TOKEN}`,
  'g'
);

export function getFragmentsInMarkup(markup: string) {
  return [...markup.matchAll(MARKUP_FRAGMENTS_PATTERN)].map((match) => ({
    value: match[0],
    index: match.index,
  }));
}

// Lax parser does NOT complain about leading/trailing spaces inside ranges (e.g. `(1 .. 10 )`) and
// within the parenthesis (e.g. `( 1 .. 10 )`), but fails to render the liquid when using the gem.
// Strict parser does NOT complain, but still renders it.
// To avoid any issues, we will remove extra spaces.
const RANGE_MARKUP_REGEX = /\(\s*(\w+)\s*(\.{2,})\s*(\w+)\s*\)/;

export function getRangeMatch(markup: string) {
  return markup.match(RANGE_MARKUP_REGEX);
}

export function doesFragmentContainUnsupportedParentheses(fragment: string) {
  if (getRangeMatch(fragment)) {
    return false;
  }

  return fragment.includes('(') || fragment.includes(')');
}

export function fragmentKeyValuePair(fragment: string) {
  const match = fragment.match(new RegExp(KEY_VALUE_PAIR));

  if (!match) {
    return;
  }

  const [, key, value] = match;

  return {
    key,
    value,
  }
}
