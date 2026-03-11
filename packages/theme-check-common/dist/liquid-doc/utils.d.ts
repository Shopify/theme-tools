import { LiquidExpression } from '@shopify/liquid-html-parser';
import { ObjectEntry, UriString } from '../types';
/**
 * The base set of supported param types for LiquidDoc.
 *
 * This is used in conjunction with objects defined in [liquid docs](https://shopify.dev/docs/api/liquid/objects)
 * to determine ALL supported param types for LiquidDoc.
 *
 * References `getValidParamTypes`
 */
export declare enum BasicParamTypes {
    String = "string",
    Number = "number",
    Boolean = "boolean",
    Object = "object"
}
export declare enum SupportedDocTagTypes {
    Param = "param",
    Example = "example",
    Description = "description"
}
/**
 * Provides a default completion value for an argument / parameter of a given type.
 */
export declare function getDefaultValueForType(type: string | null): "" | "0" | "''" | "false";
/**
 * Casts the value of a LiquidNamedArgument to a string representing the type of the value.
 */
export declare function inferArgumentType(arg: LiquidExpression): BasicParamTypes;
/**
 * Checks if the provided argument type is compatible with the expected type.
 * Makes certain types more permissive:
 * - Boolean accepts any value, since everything is truthy / falsy in Liquid
 */
export declare function isTypeCompatible(expectedType: string, actualType: BasicParamTypes): boolean;
/**
 * Checks if the provided file path supports the LiquidDoc tag.
 */
export declare function filePathSupportsLiquidDoc(uri: UriString): boolean;
/**
 * Dynamically generates a map of LiquidDoc param types using object entries from
 * [liquid docs](https://shopify.dev/docs/api/liquid/objects).
 *
 * This is used in conjunction with the base set of supported param.
 *
 * References `BasicParamTypes`
 */
export declare function getValidParamTypes(objectEntries: ObjectEntry[]): Map<string, string | undefined>;
export declare function parseParamType(validParamTypes: Set<string>, value: string): [pseudoType: string, isArray: boolean] | undefined;
