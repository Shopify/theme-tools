import { LiquidExpression, NodeTypes } from '@shopify/liquid-html-parser';
import { assertNever } from '../utils';
import { isSnippet } from '../to-schema';
import { isBlock } from '../to-schema';
import { UriString } from '../types';

export enum SupportedParamTypes {
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
    case SupportedParamTypes.String:
      return "''";
    case SupportedParamTypes.Number:
      return '0';
    case SupportedParamTypes.Boolean:
      return 'false';
    case SupportedParamTypes.Object: // Objects don't have a sensible default value (maybe `theme`?)
    default:
      return '';
  }
}

/**
 * Casts the value of a LiquidNamedArgument to a string representing the type of the value.
 */
export function inferArgumentType(arg: LiquidExpression): SupportedParamTypes {
  switch (arg.type) {
    case NodeTypes.String:
      return SupportedParamTypes.String;
    case NodeTypes.Number:
      return SupportedParamTypes.Number;
    case NodeTypes.LiquidLiteral:
      return SupportedParamTypes.Boolean;
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
      return SupportedParamTypes.Object;
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
export function isTypeCompatible(expectedType: string, actualType: SupportedParamTypes): boolean {
  const normalizedExpectedType = expectedType.toLowerCase();

  if (normalizedExpectedType === SupportedParamTypes.Boolean) {
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
