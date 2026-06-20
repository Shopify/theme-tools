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

/** Matches single- or double-quoted string literals, e.g. 'banner' or "label" */
const LITERAL_TYPE_RE = /^'[^']*'$|^"[^"]*"$/;

export enum SupportedDocTagTypes {
  Param = 'param',
  Example = 'example',
  Description = 'description',
}

/**
 * Provides a default completion value for an argument / parameter of a given type.
 * For union types, uses the first member. For string literal types, uses the literal itself.
 */
export function getDefaultValueForType(type: string | null) {
  const firstMember = type?.split('|')[0] ?? null;

  if (firstMember && LITERAL_TYPE_RE.test(firstMember)) {
    return firstMember;
  }

  switch (firstMember?.toLowerCase()) {
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
 * Supports union types (e.g. string|number) and string literal types (e.g. 'banner'|'label').
 * Makes certain types more permissive:
 * - Boolean accepts any value, since everything is truthy / falsy in Liquid
 * - String literal types (e.g. 'banner') accept any string value
 */
export function isTypeCompatible(expectedType: string, actualType: BasicParamTypes): boolean {
  return expectedType.split('|').some((member) => {
    if (LITERAL_TYPE_RE.test(member)) {
      return actualType === BasicParamTypes.String;
    }

    const normalized = member.toLowerCase();

    if (normalized === BasicParamTypes.Boolean) return true;

    return normalized === actualType;
  });
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
  const members = value.split('|');

  for (const member of members) {
    if (LITERAL_TYPE_RE.test(member)) continue;

    const namedTypeMatch = member.match(/^([a-z_]+)(\[\])?$/);
    if (!namedTypeMatch) return undefined;
    if (!validParamTypes.has(namedTypeMatch[1])) return undefined;
  }

  // Return the first named type member for backward-compat callers; fall back to string for literal-only unions
  const firstNamed = members.find((m) => !LITERAL_TYPE_RE.test(m));
  if (firstNamed) {
    const match = firstNamed.match(/^([a-z_]+)(\[\])?$/)!;
    return [match[1], !!match[2]];
  }

  return [BasicParamTypes.String, false];
}
