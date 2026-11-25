import { BlockArrayLiteral, LiquidExpression, NodeTypes } from '@shopify/liquid-html-parser';
import { assertNever } from '../utils';
import { isSnippet } from '../to-schema';
import { isBlock } from '../to-schema';
import { ObjectEntry, UriString } from '../types';
import { normalizeNamedParamType, parseStringLiterals } from './doc-param-type';

export {
  normalizeNamedParamType,
  parseDocParamType,
  parseParamType,
  parseParamTypeSyntax,
  parseStringLiterals,
} from './doc-param-type';
export type { DocParamType, StringLiteralType } from './doc-param-type';

/**
 * The base set of supported param types for LiquidDoc.
 *
 * This is used in conjunction with objects defined in [liquid docs](https://shopify.dev/docs/api/liquid/objects)
 * to determine ALL supported param types for LiquidDoc.
 *
 * References `getValidParamTypes`
 */
export enum BasicParamTypes {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Object = 'object',
}

export enum SupportedDocTagTypes {
  Param = 'param',
  Example = 'example',
  Description = 'description',
}

/**
 * Provides a default completion value for an argument / parameter of a given type.
 */
export function getDefaultValueForType(type: string | null) {
  const literals = type ? parseStringLiterals(type) : undefined;
  if (literals) return literals[0].raw;

  switch (type?.toLowerCase()) {
    case BasicParamTypes.String:
      return "''";
    case BasicParamTypes.Number:
      return '0';
    case BasicParamTypes.Boolean:
      return 'false';
    case BasicParamTypes.Object: // Objects don't have a sensible default value (maybe `theme`?)
    default:
      return '';
  }
}

/**
 * Casts the value of a LiquidNamedArgument to a string representing the type of the value.
 */
export function inferArgumentType(arg: LiquidExpression): BasicParamTypes {
  switch (arg.type) {
    case NodeTypes.String:
      return BasicParamTypes.String;
    case NodeTypes.Number:
      return BasicParamTypes.Number;
    case NodeTypes.LiquidLiteral:
      return BasicParamTypes.Boolean;
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
      return BasicParamTypes.Object;
    default:
      // This ensures that we have a case for every possible type for arg.value
      return assertNever(arg);
  }
}

/**
 * Checks if the provided argument type is compatible with the expected type.
 * Makes certain types more permissive:
 * - Boolean accepts any value, since everything is truthy / falsy in Liquid
 */
export function isTypeCompatible(expectedType: string, actualType: BasicParamTypes): boolean {
  const normalizedExpectedType = expectedType.toLowerCase();

  if (normalizedExpectedType === BasicParamTypes.Boolean) {
    return true;
  }

  return normalizedExpectedType === actualType;
}

/**
 * The result of checking an argument value against its LiquidDoc type.
 *
 * - `compatible` and `incompatible`: the literal value was checked.
 * - `unchecked`: the value is dynamic, the type is malformed, or a block array
 *   literal is compared with a type other than a string enum.
 * - `named-type`: the type is a named Liquid type or array, such as `product`
 *   or `string[]`, and `type` is its lowercase spelling. No literal matches
 *   it, but only the docset can confirm that the type exists.
 */
export type ArgumentTypeCheck =
  | { kind: 'compatible' }
  | { kind: 'incompatible' }
  | { kind: 'unchecked' }
  | { kind: 'named-type'; type: string };

/** Checks a literal argument value against a LiquidDoc type. */
export function checkArgumentType(
  expectedType: string,
  argument: LiquidExpression | BlockArrayLiteral,
): ArgumentTypeCheck {
  if (argument.type === NodeTypes.VariableLookup) return { kind: 'unchecked' };

  const literals = parseStringLiterals(expectedType);
  if (literals) {
    return literalCheck(
      argument.type === NodeTypes.String &&
        literals.some((literal) => literal.value === argument.value),
    );
  }

  if (argument.type === 'BlockArrayLiteral') return { kind: 'unchecked' };

  const type = normalizeNamedParamType(expectedType);
  if (!type) return { kind: 'unchecked' };
  if (!isBasicParamType(type)) return { kind: 'named-type', type };

  return literalCheck(isTypeCompatible(type, inferArgumentType(argument)));
}

function literalCheck(matches: boolean): ArgumentTypeCheck {
  return matches ? { kind: 'compatible' } : { kind: 'incompatible' };
}

function isBasicParamType(type: string): type is BasicParamTypes {
  return Object.values(BasicParamTypes).some((basicType) => basicType === type);
}

export function getArgumentTypeMismatchMessage(
  name: string,
  expectedType: string,
  argument: LiquidExpression | BlockArrayLiteral,
): string {
  if (parseStringLiterals(expectedType)) {
    const actualValue = argument.source.slice(argument.position.start, argument.position.end);
    return `Invalid value for argument '${name}': expected ${expectedType.trim()}, got ${actualValue}`;
  }

  const actualType = argument.type === 'BlockArrayLiteral' ? 'array' : inferArgumentType(argument);
  return `Type mismatch for argument '${name}': expected ${expectedType.toLowerCase()}, got ${actualType}`;
}

/**
 * Checks if the provided file path supports the LiquidDoc tag.
 */
export function filePathSupportsLiquidDoc(uri: UriString) {
  return isSnippet(uri) || isBlock(uri);
}

/**
 * Dynamically generates a map of LiquidDoc param types using object entries from
 * [liquid docs](https://shopify.dev/docs/api/liquid/objects).
 *
 * This is used in conjunction with the base set of supported param.
 *
 * References `BasicParamTypes`
 */
export function getValidParamTypes(objectEntries: ObjectEntry[]): Map<string, string | undefined> {
  const paramTypes: Map<string, string | undefined> = new Map([
    [BasicParamTypes.String, undefined],
    [BasicParamTypes.Number, undefined],
    [BasicParamTypes.Boolean, undefined],
    [
      BasicParamTypes.Object,
      'A generic type used to represent any liquid object or primitive value.',
    ],
  ]);

  objectEntries.forEach((obj) => paramTypes.set(obj.name, obj.summary || obj.description));

  return paramTypes;
}
