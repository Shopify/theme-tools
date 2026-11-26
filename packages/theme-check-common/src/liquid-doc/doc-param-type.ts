/**
 * `liquid-html-parser` intentionally keeps the contents of a LiquidDoc `{type}`
 * annotation as text. Theme Check parses the supported subset here because
 * named types are validated against the active Liquid docset. If LiquidDoc gets
 * a complete type grammar, syntax parsing should move to the parser while
 * docset validation stays here.
 */
/** A string literal type, such as `'heading'`. `raw` keeps the quotes it was written with. */
export interface StringLiteralType {
  kind: 'literal';
  value: string;
  raw: string;
}

export type DocParamType =
  | { kind: 'named'; name: string }
  | { kind: 'array'; valueType: string }
  | StringLiteralType
  | { kind: 'union'; types: DocParamType[] };

/** Parses a supported LiquidDoc type while preserving its full type information. */
export function parseDocParamType(
  validParamTypes: Set<string>,
  value: string,
): DocParamType | undefined {
  const literals = parseStringLiterals(value);
  if (literals) return literals.length === 1 ? literals[0] : { kind: 'union', types: literals };

  const namedType = parseParamType(validParamTypes, value);
  if (!namedType) return undefined;

  const [name, isArray] = namedType;
  return isArray ? { kind: 'array', valueType: name } : { kind: 'named', name };
}

/**
 * Parses a type that only allows string literals, such as `'heading' | 'small'`,
 * preserving their spelling for fixes. Liquid strings do not decode backslash
 * escapes. Only an unquoted pipe separates literals, and the entire annotation
 * must be valid.
 */
export function parseStringLiterals(type: string): StringLiteralType[] | undefined {
  if (/[\r\n]/.test(type)) return undefined;

  const literals: StringLiteralType[] = [];
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

    literals.push({
      kind: 'literal',
      value: type.slice(position + 1, end),
      raw: type.slice(position, end + 1),
    });
    position = end + 1;
    skipWhitespace();

    if (position === type.length) return literals;
    if (type[position] !== '|') return undefined;
    position++;
  }

  return undefined;
}

/** Legacy tuple API for named types and arrays; string literals require parseDocParamType. */
export function parseParamType(
  validParamTypes: Set<string>,
  value: string,
): [pseudoType: string, isArray: boolean] | undefined {
  const parsedParamType = parseParamTypeSyntax(value);

  if (!parsedParamType || !validParamTypes.has(parsedParamType[0])) return undefined;

  return parsedParamType;
}

/**
 * Lowercases a named LiquidDoc type such as `Product[]`, which is how argument
 * checks compare named types. Returns undefined when the value is not valid
 * named type syntax.
 */
export function normalizeNamedParamType(value: string): string | undefined {
  const normalizedType = value.toLowerCase();
  return parseParamTypeSyntax(normalizedType) ? normalizedType : undefined;
}

/**
 * Splits a lowercase LiquidDoc type such as `product[]` into its base type
 * and array flag. Returns undefined when the value is not valid type syntax.
 */
export function parseParamTypeSyntax(
  value: string,
): [pseudoType: string, isArray: boolean] | undefined {
  const paramTypeMatch = value.match(/^([a-z_]+)(\[\])?$/);

  if (!paramTypeMatch) return undefined;

  return [paramTypeMatch[1], !!paramTypeMatch[2]];
}
