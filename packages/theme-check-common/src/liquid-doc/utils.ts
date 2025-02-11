import { LiquidNamedArgument, NodeTypes } from '@shopify/liquid-html-parser';
import { assertNever } from '../utils';

export enum SupportedTypes {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Object = 'object',
}

/**
 * Casts the value of a LiquidNamedArgument to a string representing the type of the value.
 */
export function inferArgumentType(arg: LiquidNamedArgument): SupportedTypes {
  switch (arg.value.type) {
    case NodeTypes.String:
      return SupportedTypes.String;
    case NodeTypes.Number:
      return SupportedTypes.Number;
    case NodeTypes.LiquidLiteral:
      return SupportedTypes.Boolean;
    case NodeTypes.Range:
    case NodeTypes.VariableLookup:
      return SupportedTypes.Object;
    default:
      // This ensures that we have a case for every possible type for arg.value
      return assertNever(arg.value);
  }
}

/**
 * Provides a default completion value for an argument / parameter of a given type.
 */
export function getDefaultValueForType(type: string | null) {
  switch (type?.toLowerCase()) {
    case SupportedTypes.String:
      return "''";
    case SupportedTypes.Number:
      return '0';
    case SupportedTypes.Boolean:
      return 'false';
    case SupportedTypes.Object:
      return '';
    default:
      return "''";
  }
}
