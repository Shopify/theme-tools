import { parseStringEnumType, type StringEnumType } from './string-enum-type';

export type DocParamType =
  | { kind: 'named'; name: string }
  | { kind: 'array'; valueType: string }
  | StringEnumType;

/** Parses a supported LiquidDoc type while preserving its full type information. */
export function parseDocParamType(
  validParamTypes: Set<string>,
  value: string,
): DocParamType | undefined {
  const members = parseStringEnumType(value);
  if (members) return { kind: 'string-enum', members };

  const namedType = parseParamType(validParamTypes, value);
  if (!namedType) return undefined;

  const [name, isArray] = namedType;
  return isArray ? { kind: 'array', valueType: name } : { kind: 'named', name };
}

/** Legacy tuple API for named types and arrays; enums require parseDocParamType. */
export function parseParamType(
  validParamTypes: Set<string>,
  value: string,
): [pseudoType: string, isArray: boolean] | undefined {
  const paramTypeMatch = value.match(/^([a-z_]+)(\[\])?$/);

  if (!paramTypeMatch) return undefined;

  const extractedParamType = paramTypeMatch[1];
  const isArrayType = !!paramTypeMatch[2];

  if (!validParamTypes.has(extractedParamType)) return undefined;

  return [extractedParamType, isArrayType];
}
