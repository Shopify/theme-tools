import { LiquidExpression, NodeTypes } from '@shopify/liquid-html-parser';
import { assertNever } from '../utils';
import { isSnippet } from '../to-schema';
import { isBlock } from '../to-schema';
import { ObjectEntry, UriString } from '../types';

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
