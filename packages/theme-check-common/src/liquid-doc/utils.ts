import { LiquidNamedArgument, NodeTypes } from '@shopify/liquid-html-parser';
import { assertNever } from '../utils';

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
    case SupportedParamTypes.Object:
      return 'empty';
    default:
      return '';
  }
}

/**
 * Casts the value of a LiquidNamedArgument to a string representing the type of the value.
 */
export function inferArgumentType(arg: LiquidNamedArgument): SupportedParamTypes {
  switch (arg.value.type) {
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
      return assertNever(arg.value);
  }
}
