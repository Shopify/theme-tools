export interface StringEnumMember {
  value: string;
  raw: string;
}

export interface StringEnumType {
  kind: 'string-enum';
  members: StringEnumMember[];
}

/**
 * Parses a union of quoted Liquid strings, preserving their spelling for fixes.
 * Liquid strings do not decode backslash escapes. Only an unquoted pipe separates
 * members, and the entire annotation must be a valid enum.
 */
export function parseStringEnumType(type: string): StringEnumMember[] | undefined {
  if (/[\r\n]/.test(type)) return undefined;

  const members: StringEnumMember[] = [];
  let position = 0;

  function skipWhitespace() {
    while (type[position] === ' ' || type[position] === '\t') position++;
  }

  while (position < type.length) {
    skipWhitespace();
    const quote = type[position];
    if (quote !== "'" && quote !== '"') return undefined;

    const end = type.indexOf(quote, position + 1);
    if (end === -1) return undefined;

    members.push({
      value: type.slice(position + 1, end),
      raw: type.slice(position, end + 1),
    });
    position = end + 1;
    skipWhitespace();

    if (position === type.length) return members;
    if (type[position] !== '|') return undefined;
    position++;
  }

  return undefined;
}
