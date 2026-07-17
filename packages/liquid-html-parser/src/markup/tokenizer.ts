export enum MarkupTokenType {
  Id = 'Id',
  String = 'String',
  Number = 'Number',
  Dot = 'Dot',
  DotDot = 'DotDot',
  Pipe = 'Pipe',
  Colon = 'Colon',
  Comma = 'Comma',
  OpenRound = 'OpenRound',
  CloseRound = 'CloseRound',
  OpenSquare = 'OpenSquare',
  CloseSquare = 'CloseSquare',
  Dash = 'Dash',
  Comparison = 'Comparison',
  Equality = 'Equality',
  Logical = 'Logical',
  EndOfString = 'EndOfString',
}

export interface MarkupToken {
  type: MarkupTokenType;
  value: string;
  start: number;
  end: number;
}

const ID_RE = /[a-zA-Z_][\w-]*\??/y;
const NUMBER_RE = /\d[\d_]*(\.\d[\d_]*)?/y;
const WHITESPACE_RE = /\s+/y;
const SINGLE_STRING_RE = /'[^']*'/y;
const DOUBLE_STRING_RE = /"[^"]*"/y;

export function tokenizeMarkup(markup: string, startOffset = 0): MarkupToken[] {
  const tokens: MarkupToken[] = [];
  let pos = 0;
  let lastTokenType: MarkupTokenType | undefined;

  while (pos < markup.length) {
    WHITESPACE_RE.lastIndex = pos;
    if (WHITESPACE_RE.test(markup)) {
      pos = WHITESPACE_RE.lastIndex;
      continue;
    }

    const ch = markup[pos];
    const next = pos + 1 < markup.length ? markup[pos + 1] : '';

    if (ch === "'" || ch === '"') {
      const re = ch === "'" ? SINGLE_STRING_RE : DOUBLE_STRING_RE;
      re.lastIndex = pos;
      if (re.test(markup)) {
        const value = markup.slice(pos, re.lastIndex);
        tokens.push({
          type: MarkupTokenType.String,
          value,
          start: pos + startOffset,
          end: re.lastIndex + startOffset,
        });
        lastTokenType = MarkupTokenType.String;
        pos = re.lastIndex;
        continue;
      }
    }

    if (ch === '-' && /\d/.test(next)) {
      NUMBER_RE.lastIndex = pos + 1;
      if (NUMBER_RE.test(markup)) {
        const value = markup.slice(pos, NUMBER_RE.lastIndex);
        tokens.push({
          type: MarkupTokenType.Number,
          value,
          start: pos + startOffset,
          end: NUMBER_RE.lastIndex + startOffset,
        });
        lastTokenType = MarkupTokenType.Number;
        pos = NUMBER_RE.lastIndex;
        continue;
      }
    }

    if (/\d/.test(ch)) {
      NUMBER_RE.lastIndex = pos;
      if (NUMBER_RE.test(markup)) {
        const matchEnd = NUMBER_RE.lastIndex;
        // Check if the "decimal" is actually the start of a DotDot
        // e.g. "1.5..10" — the number regex would greedily match "1.5"
        // but "1.5.." means "1.5" then ".." which is fine.
        // However "1..5" should be "1" then ".." then "5".
        // We need to check: did the regex consume a dot, and is the char after the match a dot?
        const value = markup.slice(pos, matchEnd);
        tokens.push({
          type: MarkupTokenType.Number,
          value,
          start: pos + startOffset,
          end: matchEnd + startOffset,
        });
        lastTokenType = MarkupTokenType.Number;
        pos = matchEnd;
        continue;
      }
    }

    ID_RE.lastIndex = pos;
    if (ID_RE.test(markup)) {
      const value = markup.slice(pos, ID_RE.lastIndex);
      let type = MarkupTokenType.Id;
      if (lastTokenType !== MarkupTokenType.Dot) {
        if (value === 'contains') type = MarkupTokenType.Comparison;
        else if (value === 'and' || value === 'or') type = MarkupTokenType.Logical;
      }
      tokens.push({ type, value, start: pos + startOffset, end: ID_RE.lastIndex + startOffset });
      lastTokenType = type;
      pos = ID_RE.lastIndex;
      continue;
    }

    // Two-char operators
    if (next !== '') {
      const two = ch + next;
      if (two === '==' || two === '!=') {
        tokens.push({
          type: MarkupTokenType.Equality,
          value: two,
          start: pos + startOffset,
          end: pos + 2 + startOffset,
        });
        lastTokenType = MarkupTokenType.Equality;
        pos += 2;
        continue;
      }
      if (two === '>=' || two === '<=') {
        tokens.push({
          type: MarkupTokenType.Comparison,
          value: two,
          start: pos + startOffset,
          end: pos + 2 + startOffset,
        });
        lastTokenType = MarkupTokenType.Comparison;
        pos += 2;
        continue;
      }
      if (two === '..') {
        tokens.push({
          type: MarkupTokenType.DotDot,
          value: '..',
          start: pos + startOffset,
          end: pos + 2 + startOffset,
        });
        lastTokenType = MarkupTokenType.DotDot;
        pos += 2;
        continue;
      }
    }

    // Single-char operators
    const singleCharToken = singleChar(ch);
    if (singleCharToken !== undefined) {
      tokens.push({
        type: singleCharToken,
        value: ch,
        start: pos + startOffset,
        end: pos + 1 + startOffset,
      });
      lastTokenType = singleCharToken;
      pos += 1;
      continue;
    }

    // Unknown character — skip (should not happen in valid Liquid markup)
    pos += 1;
  }

  tokens.push({
    type: MarkupTokenType.EndOfString,
    value: '',
    start: markup.length + startOffset,
    end: markup.length + startOffset,
  });

  return tokens;
}

function singleChar(ch: string): MarkupTokenType | undefined {
  switch (ch) {
    case '.':
      return MarkupTokenType.Dot;
    case '|':
      return MarkupTokenType.Pipe;
    case ':':
      return MarkupTokenType.Colon;
    case ',':
      return MarkupTokenType.Comma;
    case '(':
      return MarkupTokenType.OpenRound;
    case ')':
      return MarkupTokenType.CloseRound;
    case '[':
      return MarkupTokenType.OpenSquare;
    case ']':
      return MarkupTokenType.CloseSquare;
    case '-':
      return MarkupTokenType.Dash;
    case '>':
      return MarkupTokenType.Comparison;
    case '<':
      return MarkupTokenType.Comparison;
    case '=':
      return MarkupTokenType.Equality;
    default:
      return undefined;
  }
}
