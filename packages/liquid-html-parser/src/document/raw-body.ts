import { TagKind } from '../tag-definitions';
import type { LiquidLine, RawBodyEnd, RawBodyRule, TagDefinition } from '../tag-definitions';

// Liquid's `BlockBody::FullToken`, `FullTokenPossiblyInvalid` and `LiquidTagToken`,
// with Ruby's ASCII `\s`.
const RUBY_WHITESPACE = '[ \\t\\n\\v\\f\\r]';
const FULL_TOKEN = new RegExp(
  `^\\{%-?${RUBY_WHITESPACE}*(#|\\w+)${RUBY_WHITESPACE}*[\\s\\S]*?-?%\\}$`,
);
const TRAILING_TAG_NAME = new RegExp(`\\{%-?${RUBY_WHITESPACE}*(\\w+)`, 'y');
const LIQUID_TAG_NAME = /^(#|\w+)/;
const RUBY_LINE_INDENT = /^[ \t\v\f\r]*$/;
const TAG_OR_VARIABLE_START = /\{[{%]/g;

/** Looks up the body rule of another raw tag, for the tags a rule skips as opaque. */
export type RawBodyRuleFor = (tagName: string) => RawBodyRule | undefined;

/** The `RawBodyRuleFor` of a tag registry: a raw tag's body rule, or undefined for any other tag. */
export function rawBodyRuleLookup(
  tagForName: (name: string) => TagDefinition | undefined,
): RawBodyRuleFor {
  return (name) => {
    const def = tagForName(name);
    return def?.kind === TagKind.Raw ? def.body : undefined;
  };
}

/** The name of the tag a whole `{% … %}` token opens, read the way `findRawBodyEnd` reads it. */
export function liquidTagTokenName(token: string): string | undefined {
  return FULL_TOKEN.exec(token)?.[1];
}

/**
 * Where the body of `tagName` that starts at `bodyStart` ends under `rule`,
 * reading the source as `Liquid::Tokenizer` tokens. Returns null where Liquid
 * reports the tag as never closed, or rejects a tag nested inside it.
 */
export function findRawBodyEnd(
  source: string,
  bodyStart: number,
  tagName: string,
  rule: RawBodyRule,
  ruleFor: RawBodyRuleFor,
): RawBodyEnd | null {
  const endName = `end${tagName}`;
  let tokenStart = bodyStart;
  let depth = 1;

  while (tokenStart < source.length) {
    // Text cannot name a tag. Advance straight to the next Liquid token,
    // without slicing or inspecting the intervening text as another token.
    TAG_OR_VARIABLE_START.lastIndex = tokenStart;
    if (
      source[tokenStart] !== '{' ||
      (source[tokenStart + 1] !== '%' && source[tokenStart + 1] !== '{')
    ) {
      const open = TAG_OR_VARIABLE_START.exec(source);
      if (!open) return null;
      tokenStart = open.index;
    }
    const tokenEnd =
      source[tokenStart + 1] === '%'
        ? tagTokenEnd(source, tokenStart + 2)
        : variableTokenEnd(source, tokenStart + 2);
    const token = source.slice(tokenStart, tokenEnd);
    const tag = tokenTag(token, rule.delimiter);

    if (tag?.[1] === endName) {
      depth -= 1;
      if (depth === 0) {
        const tagStart = tokenStart + tag.index;
        return {
          tagStart,
          tagEnd: tokenEnd,
          wsStart: source[tagStart + 2] === '-' ? '-' : '',
          wsEnd: token[token.length - 3] === '-' ? '-' : '',
        };
      }
    } else if (tag?.[1] === tagName) {
      if (rule.sameName === 'rejected') return null;
      if (rule.sameName === 'nests') depth += 1;
    } else if (tag && rule.opaque.includes(tag[1])) {
      const innerRule = ruleFor(tag[1]);
      if (innerRule) {
        const innerEnd = findRawBodyEnd(source, tokenEnd, tag[1], innerRule, ruleFor);
        if (!innerEnd) return null;
        tokenStart = innerEnd.tagEnd;
        continue;
      }
    }
    tokenStart = tokenEnd;
  }

  return null;
}

/**
 * The index of the line that ends the body of `tagName` starting at `lines[from]`
 * inside `{% liquid %}`, where each line is a token named by its leading `#` or
 * word. Returns null where Liquid reports the tag as never closed there.
 */
export function findRawLineBodyEnd(
  source: string,
  lines: readonly LiquidLine[],
  from: number,
  tagName: string,
  rule: RawBodyRule,
  ruleFor: RawBodyRuleFor,
): number | null {
  if (!rule.closesInLiquidTag) return null;

  const endName = `end${tagName}`;
  let depth = 1;

  for (let index = from; index < lines.length; index++) {
    const name = lineTagName(source, lines[index]);

    if (name === endName) {
      depth -= 1;
      if (depth === 0) return index;
    } else if (name === tagName) {
      if (rule.sameName === 'rejected') return null;
      if (rule.sameName === 'nests') depth += 1;
    } else if (name !== undefined && rule.opaque.includes(name)) {
      const innerRule = ruleFor(name);
      if (innerRule) {
        const innerEnd = findRawLineBodyEnd(source, lines, index + 1, name, innerRule, ruleFor);
        if (innerEnd === null) return null;
        index = innerEnd;
      }
    }
  }

  return null;
}

// The tag a token names under `delimiter`, and where that tag starts in the token.
function tokenTag(token: string, delimiter: RawBodyRule['delimiter']): RegExpExecArray | undefined {
  if (!token.endsWith('%}')) return undefined;
  if (delimiter === 'leading') {
    return FULL_TOKEN.exec(token) ?? undefined;
  }
  // Raw accepts the last tag opener in a Liquid token, including one inside
  // an unfinished output. Search backwards without backtracking over its text.
  for (
    let offset = token.lastIndexOf('{%', token.length - 3);
    offset !== -1;
    offset = token.lastIndexOf('{%', offset - 1)
  ) {
    TRAILING_TAG_NAME.lastIndex = offset;
    const match = TRAILING_TAG_NAME.exec(token);
    if (match) return match;
    if (offset === 0) break;
  }
  return undefined;
}

// `BlockBody::LiquidTagToken` indents only with ASCII whitespace, so a line
// indented with a character such as U+00A0 has no name.
function lineTagName(source: string, line: LiquidLine): string | undefined {
  const lineStart = source.lastIndexOf('\n', line.nameOffset - 1) + 1;
  if (!RUBY_LINE_INDENT.test(source.slice(lineStart, line.nameOffset))) return undefined;
  return LIQUID_TAG_NAME.exec(line.tagName)?.[1];
}

// `Tokenizer#next_tag_token`: an unterminated `{%` is a token of its own.
function tagTokenEnd(source: string, afterOpen: number): number {
  const close = source.indexOf('%}', afterOpen);
  return close === -1 ? afterOpen : close + 2;
}

// `Tokenizer#next_variable_token`: a `{%` inside an unfinished `{{` extends it to that tag's `%}`.
function variableTokenEnd(source: string, afterOpen: number): number {
  let position = afterOpen;
  let current = source[position++];
  let next = current;

  while (next !== undefined) {
    while (current !== undefined && current !== '}' && current !== '{') {
      current = source[position++];
    }
    if (current === undefined || position >= source.length) return source.length;

    next = source[position++];
    if (current === '}') return next === '}' ? position : position - 1;
    if (current === '{' && next === '%') return tagTokenEnd(source, position);
    current = next;
  }

  return source.length;
}
