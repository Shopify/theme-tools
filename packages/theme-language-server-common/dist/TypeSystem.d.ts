import { AssignMarkup, ComplexLiquidExpression, LiquidHtmlNode, LiquidVariable, LiquidVariableLookup } from '@shopify/liquid-html-parser';
import { DocsetEntry, FilterEntry, MetafieldDefinitionMap, ObjectEntry, ThemeDocset } from '@shopify/theme-check-common';
import { GetThemeSettingsSchemaForURI } from './settings';
export declare class TypeSystem {
    private readonly themeDocset;
    private readonly getThemeSettingsSchemaForURI;
    private readonly getMetafieldDefinitions;
    constructor(themeDocset: ThemeDocset, getThemeSettingsSchemaForURI: GetThemeSettingsSchemaForURI, getMetafieldDefinitions: (rootUri: string) => Promise<MetafieldDefinitionMap>);
    inferType(thing: Identifier | ComplexLiquidExpression | LiquidVariable | AssignMarkup, partialAst: LiquidHtmlNode, uri: string): Promise<PseudoType | ArrayType>;
    availableVariables(partialAst: LiquidHtmlNode, partial: string, node: LiquidVariableLookup, uri: string): Promise<{
        entry: DocsetEntry;
        type: PseudoType | ArrayType;
    }[]>;
    themeSettingProperties(uri: string): Promise<ObjectEntry[]>;
    /**
     * An indexed representation of objects.json by name
     *
     * e.g. objectMap['product'] returns the product ObjectEntry.
     */
    objectMap: (uri: string, ast: LiquidHtmlNode) => Promise<ObjectMap>;
    metafieldDefinitionsObjectMap(uri: string): Promise<ObjectMap>;
    private _objectMap;
    /** An indexed representation of filters.json by name */
    filtersMap: import("@shopify/theme-check-common").MemoedFunction<() => Promise<FiltersMap>>;
    filterEntries: import("@shopify/theme-check-common").MemoedFunction<() => Promise<FilterEntry[]>>;
    objectEntries(uri?: string): Promise<ObjectEntry[]>;
    private symbolsTable;
    /**
     * The seedSymbolsTable contains all the global variables.
     *
     * This lets us have the ambient type of things first, but if someone
     * reassigns product, then we'll be able to change the type of product on
     * the appropriate range.
     *
     * This is not memo'ed because we would otherwise need to clone the thing.
     */
    private seedSymbolsTable;
    private globalVariables;
    private contextualVariables;
}
/** An indexed representation on objects.json (by name) */
type ObjectMap = Record<ObjectEntryName, ObjectEntry>;
/** An indexed representation on filters.json (by name) */
type FiltersMap = Record<FilterEntryName, FilterEntry>;
/** An identifier refers to the name of a variable, e.g. `x`, `product`, etc. */
type Identifier = string;
type ObjectEntryName = ObjectEntry['name'];
type FilterEntryName = FilterEntry['name'];
/** Untyped is for declared variables without a type (like `any`) */
export declare const Untyped: "untyped";
export type Untyped = typeof Untyped;
/** Unknown is for variables that don't exist, type would come from context (e.g. snippet var without LiquidDoc) */
export declare const Unknown: "unknown";
export type Unknown = typeof Untyped;
declare const String: "string";
type String = typeof String;
/** A pseudo-type is the possible values of an ObjectEntry's return_type.type */
export type PseudoType = ObjectEntryName | String | Untyped | Unknown | 'number' | 'boolean';
/** Some things can be an array type (e.g. product.images) */
export type ArrayType = {
    kind: 'array';
    valueType: PseudoType;
};
/**
 * This function converts the return_type property in one of the .json
 * files into a PseudoType or ArrayType.
 */
export declare function docsetEntryReturnType(entry: ObjectEntry | FilterEntry, defaultValue: PseudoType): PseudoType | ArrayType;
export declare function isArrayType(thing: PseudoType | ArrayType): thing is ArrayType;
export {};
