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
      return "''";
  }
}
