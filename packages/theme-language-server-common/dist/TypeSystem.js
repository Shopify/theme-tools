"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Unknown = exports.Untyped = exports.TypeSystem = void 0;
exports.docsetEntryReturnType = docsetEntryReturnType;
exports.isArrayType = isArrayType;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const settings_1 = require("./settings");
const utils_1 = require("./utils");
const theme_check_common_2 = require("@shopify/theme-check-common");
class TypeSystem {
    constructor(themeDocset, getThemeSettingsSchemaForURI, getMetafieldDefinitions) {
        this.themeDocset = themeDocset;
        this.getThemeSettingsSchemaForURI = getThemeSettingsSchemaForURI;
        this.getMetafieldDefinitions = getMetafieldDefinitions;
        /**
         * An indexed representation of objects.json by name
         *
         * e.g. objectMap['product'] returns the product ObjectEntry.
         */
        this.objectMap = async (uri, ast) => {
            var _a, _b, _c, _d;
            const [objectMap, themeSettingProperties, metafieldDefinitionsObjectMap] = await Promise.all([
                this._objectMap(uri),
                this.themeSettingProperties(uri),
                this.metafieldDefinitionsObjectMap(uri),
            ]);
            // Here we shallow mutate `settings.properties` to have the properties made
            // available by settings_schema.json
            const result = {
                ...objectMap,
                settings: {
                    ...((_a = objectMap.settings) !== null && _a !== void 0 ? _a : {}),
                    properties: themeSettingProperties,
                },
                ...customMetafieldTypeEntries(objectMap['metafield']),
                ...metafieldDefinitionsObjectMap,
            };
            // For each metafield definition fetched, we need to override existing types with `metafields` property
            // to `${category}_metafield`.
            //
            // WARNING: Since we aren't cloning the object, we are mutating the original type for all themes in
            // the workspace. However, this is fine since these changes are not unique to a theme.
            for (let category of theme_check_common_1.FETCHED_METAFIELD_CATEGORIES) {
                if (!result[category])
                    continue;
                let metafieldsProperty = (_b = result[category].properties) === null || _b === void 0 ? void 0 : _b.find((prop) => prop.name === 'metafields');
                if (!metafieldsProperty)
                    continue;
                metafieldsProperty.return_type = [{ type: `${category}_metafields`, name: '' }];
            }
            // Deal with sections/file.liquid section.settings by infering the type from the {% schema %}
            if (/[\/\\]sections[\/\\]/.test(uri) && result.section) {
                result.section = JSON.parse(JSON.stringify(result.section)); // easy deep clone
                const settings = (_c = result.section.properties) === null || _c === void 0 ? void 0 : _c.find((x) => x.name === 'settings');
                if (!settings || !settings.return_type)
                    return result;
                settings.return_type = [{ type: 'section_settings', name: '' }];
                result.section_settings = {
                    name: 'section_settings',
                    access: {
                        global: false,
                        parents: [],
                        template: [],
                    },
                    properties: schemaSettingsAsProperties(ast),
                    return_type: [],
                };
            }
            // Deal with blocks/files.liquid block.settings in a similar fashion
            if (/[\/\\]blocks[\/\\]/.test(uri) && result.block) {
                result.block = JSON.parse(JSON.stringify(result.block)); // easy deep clone
                const settings = (_d = result.block.properties) === null || _d === void 0 ? void 0 : _d.find((x) => x.name === 'settings');
                if (!settings || !settings.return_type)
                    return result;
                settings.return_type = [{ type: 'block_settings', name: '' }];
                result.block_settings = {
                    name: 'block_settings',
                    access: {
                        global: false,
                        parents: [],
                        template: [],
                    },
                    properties: schemaSettingsAsProperties(ast),
                    return_type: [],
                };
            }
            return result;
        };
        /** An indexed representation of filters.json by name */
        this.filtersMap = (0, utils_1.memo)(async () => {
            const entries = await this.filterEntries();
            return entries.reduce((map, entry) => {
                map[entry.name] = entry;
                return map;
            }, {});
        });
        this.filterEntries = (0, utils_1.memo)(async () => {
            return this.themeDocset.filters();
        });
        /**
         * The seedSymbolsTable contains all the global variables.
         *
         * This lets us have the ambient type of things first, but if someone
         * reassigns product, then we'll be able to change the type of product on
         * the appropriate range.
         *
         * This is not memo'ed because we would otherwise need to clone the thing.
         */
        this.seedSymbolsTable = async (uri) => {
            const [globalVariables, contextualVariables] = await Promise.all([
                this.globalVariables(uri),
                this.contextualVariables(uri),
            ]);
            return globalVariables.concat(contextualVariables).reduce((table, objectEntry) => {
                var _a;
                var _b;
                (_a = table[_b = objectEntry.name]) !== null && _a !== void 0 ? _a : (table[_b] = []);
                table[objectEntry.name].push({
                    identifier: objectEntry.name,
                    type: objectEntryType(objectEntry),
                    range: [0],
                });
                return table;
            }, {});
        };
        this.globalVariables = async (uri) => {
            const entries = await this.objectEntries(uri);
            return entries.filter((entry) => !entry.access || entry.access.global === true || entry.access.template.length > 0);
        };
        this.contextualVariables = async (uri) => {
            const entries = await this.objectEntries(uri);
            const contextualEntries = getContextualEntries(uri);
            return entries.filter((entry) => contextualEntries.includes(entry.name));
        };
    }
    async inferType(thing, partialAst, uri) {
        const [objectMap, filtersMap, symbolsTable] = await Promise.all([
            this.objectMap(uri, partialAst),
            this.filtersMap(),
            this.symbolsTable(partialAst, uri),
        ]);
        return inferType(thing, symbolsTable, objectMap, filtersMap);
    }
    async availableVariables(partialAst, partial, node, uri) {
        const [objectMap, filtersMap, symbolsTable] = await Promise.all([
            this.objectMap(uri, partialAst),
            this.filtersMap(),
            this.symbolsTable(partialAst, uri),
        ]);
        return Object.entries(symbolsTable)
            .filter(([key, typeRanges]) => key.startsWith(partial) &&
            typeRanges.some((typeRange) => isCorrectTypeRange(typeRange, node)))
            .map(([identifier, typeRanges]) => {
            var _a;
            const typeRange = (0, utils_1.findLast)(typeRanges, (typeRange) => isCorrectTypeRange(typeRange, node));
            const type = resolveTypeRangeType(typeRange.type, symbolsTable, objectMap, filtersMap);
            const entry = (_a = objectMap[isArrayType(type) ? type.valueType : type]) !== null && _a !== void 0 ? _a : {};
            return {
                entry: { ...entry, name: identifier },
                type,
            };
        });
    }
    async themeSettingProperties(uri) {
        const themeSettingsSchema = await this.getThemeSettingsSchemaForURI(uri);
        const categories = themeSettingsSchema.filter(settings_1.isSettingsCategory);
        const result = [];
        for (const category of categories) {
            const inputSettings = category.settings.filter(settings_1.isInputSetting);
            for (const setting of inputSettings) {
                result.push({
                    name: setting.id,
                    summary: '', // TODO, this should lookup the locale file for settings... setting.label
                    description: '', // TODO , this should lookup the locale file as well... setting.info,
                    return_type: settingReturnType(setting),
                    access: {
                        global: false,
                        parents: [],
                        template: [],
                    },
                });
            }
        }
        return result;
    }
    async metafieldDefinitionsObjectMap(uri) {
        let result = {};
        const metafieldDefinitionMap = await this.getMetafieldDefinitions(uri);
        for (let [category, definitions] of Object.entries(metafieldDefinitionMap)) {
            // Metafield definitions need to be grouped by their namespace
            let metafieldNamespaces = new Map();
            for (let definition of definitions) {
                if (!metafieldNamespaces.has(definition.namespace)) {
                    metafieldNamespaces.set(definition.namespace, []);
                }
                metafieldNamespaces.get(definition.namespace).push({
                    name: definition.key,
                    description: definition.description,
                    return_type: metafieldReturnType(definition.type.name),
                });
            }
            let metafieldGroupProperties = [];
            for (let [namespace, namespaceProperties] of metafieldNamespaces) {
                const metafieldCategoryNamespaceHandle = `${category}_metafield_${namespace}`;
                // Since the namespace can be shared by multiple categories, we need to make sure the return_type
                // handle is unique across all categories
                metafieldGroupProperties.push({
                    name: namespace,
                    return_type: [{ type: metafieldCategoryNamespaceHandle, name: '' }],
                    access: {
                        global: false,
                        parents: [],
                        template: [],
                    },
                });
                result[metafieldCategoryNamespaceHandle] = {
                    name: metafieldCategoryNamespaceHandle,
                    properties: namespaceProperties,
                    access: {
                        global: false,
                        parents: [],
                        template: [],
                    },
                };
            }
            const metafieldCategoryHandle = `${category}_metafields`;
            result[metafieldCategoryHandle] = {
                name: metafieldCategoryHandle,
                properties: metafieldGroupProperties,
                access: {
                    global: false,
                    parents: [],
                    template: [],
                },
            };
        }
        return result;
    }
    async _objectMap(uri) {
        const entries = await this.objectEntries(uri);
        return entries.reduce((map, entry) => {
            map[entry.name] = entry;
            return map;
        }, {});
    }
    hasObjectsForURI(uri) {
        var _a, _b;
        return !!((_b = (_a = this.themeDocset).getObjectsForURI) === null || _b === void 0 ? void 0 : _b.call(_a, uri));
    }
    async objectEntries(uri) {
        if (uri && this.themeDocset.getObjectsForURI) {
            const perURI = this.themeDocset.getObjectsForURI(uri);
            if (perURI)
                return perURI;
        }
        return this.themeDocset.objects();
    }
    async symbolsTable(partialAst, uri) {
        const seedSymbolsTable = await this.seedSymbolsTable(uri);
        return buildSymbolsTable(partialAst, seedSymbolsTable, await this.themeDocset.liquidDrops());
    }
}
exports.TypeSystem = TypeSystem;
const SECTION_FILE_REGEX = /sections[\/\\][^.\\\/]*\.liquid$/;
const BLOCK_FILE_REGEX = /blocks[\/\\][^.\\\/]*\.liquid$/;
const SNIPPET_FILE_REGEX = /snippets[\/\\][^.\\\/]*\.liquid$/;
const LAYOUT_FILE_REGEX = /layout[\/\\]checkout\.liquid$/;
function getContextualEntries(uri) {
    const normalizedUri = theme_check_common_1.path.normalize(uri);
    if (LAYOUT_FILE_REGEX.test(normalizedUri)) {
        return [
            'locale',
            'direction',
            'skip_to_content_link',
            'checkout_html_classes',
            'checkout_stylesheets',
            'checkout_scripts',
            'content_for_logo',
            'breadcrumb',
            'order_summary_toggle',
            'content_for_order_summary',
            'alternative_payment_methods',
            'content_for_footer',
            'tracking_code',
        ];
    }
    if (SECTION_FILE_REGEX.test(normalizedUri)) {
        return ['section', 'predictive_search', 'recommendations', 'comment'];
    }
    if (BLOCK_FILE_REGEX.test(normalizedUri)) {
        return ['app', 'section', 'recommendations', 'block'];
    }
    if (SNIPPET_FILE_REGEX.test(normalizedUri)) {
        return ['app'];
    }
    return [];
}
/** Untyped is for declared variables without a type (like `any`) */
exports.Untyped = 'untyped';
/** Unknown is for variables that don't exist, type would come from context (e.g. snippet var without LiquidDoc) */
exports.Unknown = 'unknown';
const String = 'string';
const arrayType = (valueType) => ({
    kind: 'array',
    valueType,
});
const lazyVariable = (node, offset) => ({
    kind: liquid_html_parser_1.NodeTypes.LiquidVariable,
    node,
    offset,
});
const LazyDeconstructedExpression = (node, offset) => ({
    kind: 'deconstructed',
    node,
    offset,
});
function buildSymbolsTable(partialAst, seedSymbolsTable, liquidDrops) {
    const typeRanges = (0, theme_check_common_2.visit)(partialAst, {
        // {% assign x = foo.x | filter %}
        AssignMarkup(node) {
            return {
                identifier: node.name,
                type: lazyVariable(node.value, node.position.start),
                range: [node.position.end],
            };
        },
        // {% doc %}
        //   @param {string} name - your name
        // {% enddoc %}
        LiquidDocParamNode(node) {
            return {
                identifier: node.paramName.value,
                type: inferLiquidDocParamType(node, liquidDrops),
                range: [node.position.end],
            };
        },
        // This also covers tablerow
        ForMarkup(node, ancestors) {
            var _a;
            const parentNode = ancestors.at(-1);
            return {
                identifier: node.variableName,
                type: LazyDeconstructedExpression(node.collection, node.position.start),
                range: [parentNode.blockStartPosition.end, end((_a = parentNode.blockEndPosition) === null || _a === void 0 ? void 0 : _a.end)],
            };
        },
        // {% capture foo %}
        //   ...
        // {% endcapture}
        LiquidTag(node) {
            var _a, _b;
            if (node.name === 'capture' && typeof node.markup !== 'string') {
                return {
                    identifier: node.markup.name,
                    type: String,
                    range: [node.position.end],
                };
            }
            else if (['form', 'paginate'].includes(node.name)) {
                return {
                    identifier: node.name,
                    type: node.name,
                    range: [node.blockStartPosition.end, end((_a = node.blockEndPosition) === null || _a === void 0 ? void 0 : _a.end)],
                };
            }
            else if (['for', 'tablerow'].includes(node.name)) {
                return {
                    identifier: node.name + 'loop',
                    type: node.name + 'loop',
                    range: [node.blockStartPosition.end, end((_b = node.blockEndPosition) === null || _b === void 0 ? void 0 : _b.end)],
                };
            }
            else if (isLiquidTagIncrement(node) || isLiquidTagDecrement(node)) {
                if (node.markup.name === null)
                    return;
                return {
                    identifier: node.markup.name,
                    type: 'number',
                    range: [node.position.start],
                };
            }
            else if (node.name === 'layout') {
                return {
                    identifier: 'none',
                    type: 'keyword',
                    range: [node.position.start, node.position.end],
                };
            }
        },
    });
    return typeRanges
        .sort(({ range: [startA] }, { range: [startB] }) => startA - startB)
        .reduce((table, typeRange) => {
        var _a;
        var _b;
        (_a = table[_b = typeRange.identifier]) !== null && _a !== void 0 ? _a : (table[_b] = []);
        table[typeRange.identifier].push(typeRange);
        return table;
    }, seedSymbolsTable);
}
/**
 * Given a TypeRange['type'] (which may be lazy), resolve its type recursively.
 *
 * The output is a fully resolved PseudoType | ArrayType. Which means we
 * could use it to power completions.
 */
function resolveTypeRangeType(typeRangeType, symbolsTable, objectMap, filtersMap) {
    if (typeof typeRangeType === 'string') {
        return typeRangeType;
    }
    switch (typeRangeType.kind) {
        case 'array': {
            return typeRangeType;
        }
        case 'deconstructed': {
            const arrayType = inferType(typeRangeType.node, symbolsTable, objectMap, filtersMap);
            if (typeof arrayType === 'string') {
                return exports.Untyped;
            }
            else {
                return arrayType.valueType;
            }
        }
        default: {
            return inferType(typeRangeType.node, symbolsTable, objectMap, filtersMap);
        }
    }
}
function inferType(thing, symbolsTable, objectMap, filtersMap) {
    var _a, _b;
    if (typeof thing === 'string') {
        return (_b = (_a = objectMap[thing]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : exports.Untyped;
    }
    switch (thing.type) {
        case liquid_html_parser_1.NodeTypes.Number: {
            return 'number';
        }
        case liquid_html_parser_1.NodeTypes.String: {
            return 'string';
        }
        case liquid_html_parser_1.NodeTypes.LiquidLiteral: {
            return 'boolean';
        }
        case liquid_html_parser_1.NodeTypes.BooleanExpression: {
            return 'boolean';
        }
        case liquid_html_parser_1.NodeTypes.Range: {
            return arrayType('number');
        }
        // The type of the assign markup is the type of the right hand side.
        // {% assign x = y.property | filter1 | filter2 %}
        case liquid_html_parser_1.NodeTypes.AssignMarkup: {
            return inferType(thing.value, symbolsTable, objectMap, filtersMap);
        }
        // A variable lookup is expression[.lookup]*
        // {{ y.property }}
        case liquid_html_parser_1.NodeTypes.VariableLookup: {
            return inferLookupType(thing, symbolsTable, objectMap, filtersMap);
        }
        // A variable is the VariableLookup + Filters
        // The type is the return value of the last filter
        // {{ y.property | filter1 | filter2 }}
        case liquid_html_parser_1.NodeTypes.LiquidVariable: {
            if (thing.filters.length > 0) {
                const lastFilter = thing.filters.at(-1);
                if (lastFilter.name === 'default') {
                    // default filter is a special case, we need to return the type of the expression
                    // instead of the filter.
                    if (lastFilter.args.length > 0 && lastFilter.args[0].type !== liquid_html_parser_1.NodeTypes.NamedArgument) {
                        return inferType(lastFilter.args[0], symbolsTable, objectMap, filtersMap);
                    }
                }
                const filterEntry = filtersMap[lastFilter.name];
                return filterEntry ? filterEntryReturnType(filterEntry) : exports.Untyped;
            }
            else {
                return inferType(thing.expression, symbolsTable, objectMap, filtersMap);
            }
        }
        default: {
            return exports.Untyped;
        }
    }
}
function inferLiquidDocParamType(node, liquidDrops) {
    var _a;
    const paramTypeValue = (_a = node.paramType) === null || _a === void 0 ? void 0 : _a.value;
    if (!paramTypeValue)
        return exports.Untyped;
    const validParamTypes = (0, theme_check_common_1.getValidParamTypes)(liquidDrops);
    const parsedParamType = (0, theme_check_common_1.parseParamType)(new Set(validParamTypes.keys()), paramTypeValue);
    if (!parsedParamType)
        return exports.Untyped;
    const [type, isArray] = parsedParamType;
    let transformedParamType;
    // BasicParamTypes.Object does not map to any specific type in the type system.
    if (type === theme_check_common_1.BasicParamTypes.Object) {
        transformedParamType = exports.Untyped;
    }
    else {
        transformedParamType = type;
    }
    if (isArray) {
        return arrayType(transformedParamType);
    }
    return transformedParamType;
}
function inferLookupType(thing, symbolsTable, objectMap, filtersMap) {
    // we return the type of the drop, so a.b.c
    const node = thing;
    // We don't complete global lookups. It's too much of an edge case.
    if (node.name === null)
        return exports.Untyped;
    /**
     * curr stores the type of the variable lookup starting at the beginning.
     *
     * It starts as the type of the top-level identifier, and the we
     * recursively change it to the return type of the lookups.
     *
     * So, for x.images.first.src we do:
     * - curr = infer type of x                   | x
     * - curr = x.images -> ArrayType<image>      | x.images
     * - curr = images.first -> image             | x.images.first
     * - curr = first.src -> string               | x.images.first.src
     *
     * Once were done iterating, the type of the lookup is curr.
     */
    let curr = inferIdentifierType(node, symbolsTable, objectMap, filtersMap);
    for (let lookup of node.lookups) {
        // Here we redefine curr to be the returnType of the lookup.
        // e.g. images[0] -> image
        // e.g. images.first -> image
        // e.g. images.size -> number
        if (isArrayType(curr)) {
            curr = inferArrayTypeLookupType(curr, lookup);
        }
        // e.g. product.featured_image -> image
        // e.g. product.images -> ArrayType<images>
        // e.g. product.name -> string
        else {
            curr = inferPseudoTypePropertyType(curr, lookup, objectMap);
        }
        // Early return
        if (curr === exports.Untyped) {
            return exports.Untyped;
        }
    }
    return curr;
}
/**
 * Given a VariableLookup node, infer the type of its root (position-relative).
 *
 * e.g. for the following
 *   {% assign x = product %}
 *   {{ x.images.first }}
 *
 * This function infers the type of `x`.
 */
function inferIdentifierType(node, symbolsTable, objectMap, filtersMap) {
    // The name of a variable
    const identifier = node.name;
    // We don't complete the global access edge case
    // e.g. {{ ['all_products'] }}
    if (!identifier) {
        return exports.Untyped;
    }
    const typeRanges = symbolsTable[identifier];
    if (!typeRanges) {
        return exports.Unknown;
    }
    const typeRange = (0, utils_1.findLast)(typeRanges, (tr) => isCorrectTypeRange(tr, node));
    return typeRange
        ? resolveTypeRangeType(typeRange.type, symbolsTable, objectMap, filtersMap)
        : exports.Unknown;
}
/**
 * infers the type of a lookup on an ArrayType
 * - images[0] becomes 'image'
 * - images[index] becomes 'image'
 * - images.first becomes 'image'
 * - images.last becomes 'image'
 * - images.size becomes 'number'
 * - anything else becomes 'untyped'
 */
function inferArrayTypeLookupType(curr, lookup) {
    // images[0]
    // images[index]
    if (lookup.type === liquid_html_parser_1.NodeTypes.Number || lookup.type === liquid_html_parser_1.NodeTypes.VariableLookup) {
        return curr.valueType;
    }
    // images.first
    // images.last
    // images.size
    // anything else is undef
    else if (lookup.type === liquid_html_parser_1.NodeTypes.String) {
        switch (lookup.value) {
            case 'first':
            case 'last': {
                return curr.valueType;
            }
            case 'size': {
                return 'number';
            }
            default: {
                return exports.Unknown;
            }
        }
    }
    // images[true]
    // images[(0..2)]
    else {
        return exports.Untyped;
    }
}
function inferPseudoTypePropertyType(curr, // settings
lookup, objectMap) {
    var _a;
    const parentEntry = objectMap[curr];
    // When doing a non string lookup, we don't really know the type. e.g.
    // products[0]
    // products[true]
    // products[(0..10)]
    if (lookup.type !== liquid_html_parser_1.NodeTypes.String) {
        return exports.Untyped;
    }
    // When we don't have docs for the parent entry
    if (!parentEntry) {
        // It might be that the parent entry is a string.
        // We do support a couple of properties for those
        if (curr === 'string') {
            switch (lookup.value) {
                // some_string.first
                // some_string.last
                case 'first':
                case 'last':
                    return 'string';
                // some_string.size
                case 'size':
                    return 'number';
                default: {
                    // For the string type, any property access other than first/last/size
                    // is unknown. This is different from an untyped/any object where any
                    // property access would return untyped.
                    // String is a known type with specific properties, so accessing
                    // undefined properties returns an unknown.
                    return exports.Unknown;
                }
            }
        }
        // Or it might be that the parent entry is untyped, so its subproperty
        // could also be untyped (kind of like if `foo` is `any`, then `foo.bar` is `any`)
        return exports.Untyped;
    }
    const propertyName = lookup.value;
    const property = (_a = parentEntry.properties) === null || _a === void 0 ? void 0 : _a.find((property) => property.name === propertyName);
    // When the propety is not known, return Untyped. e.g.
    // product.foo
    // product.bar
    if (!property) {
        // Debating between returning Untyped or Unknown here
        // Might be that we have outdated docs. Prob better to return Untyped.
        return exports.Untyped;
    }
    // When the property is known & we have docs for it, return its type. e.g.
    // product.image
    // product.images
    return objectEntryType(property);
}
function filterEntryReturnType(entry) {
    return docsetEntryReturnType(entry, 'string');
}
function objectEntryType(entry) {
    return docsetEntryReturnType(entry, entry.name);
}
/**
 * This function converts the return_type property in one of the .json
 * files into a PseudoType or ArrayType.
 */
function docsetEntryReturnType(entry, defaultValue) {
    const returnTypes = entry.return_type;
    if (returnTypes && returnTypes.length > 0) {
        const returnType = returnTypes[0];
        if (isArrayReturnType(returnType)) {
            return arrayType(returnType.array_value);
        }
        else {
            return returnType.type;
        }
    }
    return defaultValue;
}
function isArrayReturnType(rt) {
    return rt.type === 'array';
}
function isArrayType(thing) {
    return typeof thing !== 'string';
}
/** Assumes findLast */
function isCorrectTypeRange(typeRange, node) {
    const [start, end] = typeRange.range;
    if (end && node.position.start > end)
        return false;
    return node.position.start > start;
}
function end(offset) {
    if (offset === -1)
        return undefined;
    return offset;
}
function isLiquidTagIncrement(node) {
    return node.name === liquid_html_parser_1.NamedTags.increment && typeof node.markup !== 'string';
}
function isLiquidTagDecrement(node) {
    return node.name === liquid_html_parser_1.NamedTags.decrement && typeof node.markup !== 'string';
}
function settingReturnType(setting) {
    switch (setting.type) {
        // basic settings
        case 'checkbox':
            return [{ type: 'boolean', name: '' }];
        case 'range':
        case 'number':
            return [{ type: 'number', name: '' }];
        case 'radio':
        case 'select':
        case 'text':
        case 'textarea':
            return [{ type: 'string', name: '' }];
        // specialized settings
        case 'article':
            return [{ type: 'article', name: '' }];
        case 'blog':
            return [{ type: 'blog', name: '' }];
        case 'collection':
            return [{ type: 'collection', name: '' }];
        case 'collection_list':
            return [{ type: 'array', array_value: 'collection' }];
        case 'color':
            return [{ type: 'color', name: '' }];
        case 'color_background':
            return [{ type: 'string', name: '' }];
        case 'color_scheme':
            return [{ type: 'color_scheme', name: '' }];
        // TODO ??
        case 'color_scheme_group':
            return [];
        case 'font_picker':
            return [{ type: 'font', name: '' }];
        case 'html':
            return [{ type: 'string', name: '' }];
        case 'image_picker':
            return [{ type: 'image', name: '' }];
        case 'inline_richtext':
            return [{ type: 'string', name: '' }];
        case 'link_list':
            return [{ type: 'linklist', name: '' }];
        case 'liquid':
            return [{ type: 'string', name: '' }];
        case 'page':
            return [{ type: 'page', name: '' }];
        case 'product':
            return [{ type: 'product', name: '' }];
        case 'product_list':
            return [{ type: 'array', array_value: 'product' }];
        case 'richtext':
            return [{ type: 'string', name: '' }];
        case 'text_alignment':
            return [{ type: 'string', name: '' }];
        case 'url':
            return [{ type: 'string', name: '' }];
        case 'video':
            return [{ type: 'video', name: '' }];
        case 'video_url':
            return [{ type: 'string', name: '' }];
        default:
            return [];
    }
}
const METAFIELD_TYPE_TO_TYPE = Object.freeze({
    single_line_text_field: String,
    multi_line_text_field: String,
    url_reference: String,
    date: String,
    date_time: String,
    number_integer: 'number',
    number_decimal: 'number',
    product_reference: 'product',
    collection_reference: 'collection',
    variant_reference: 'variant',
    page_reference: 'page',
    boolean: 'boolean',
    color: 'color',
    weight: 'measurement',
    volume: 'measurement',
    dimension: 'measurement',
    rating: 'rating',
    money: 'money',
    json: exports.Untyped,
    metaobject_reference: 'metaobject',
    mixed_reference: exports.Untyped,
    rich_text_field: exports.Untyped,
    file_reference: exports.Untyped,
});
const REFERENCE_TYPE_METAFIELDS = Object.entries(METAFIELD_TYPE_TO_TYPE)
    .filter(([metafieldType, _type]) => metafieldType.endsWith('_reference'))
    .map(([_metafieldType, type]) => type);
function metafieldReturnType(metafieldType) {
    var _a;
    let isArray = metafieldType.startsWith('list.');
    if (isArray) {
        metafieldType = metafieldType.split('.')[1];
    }
    let type = 'metafield_' + ((_a = METAFIELD_TYPE_TO_TYPE[metafieldType]) !== null && _a !== void 0 ? _a : exports.Untyped);
    if (isArray) {
        return [{ type: `${type}_array`, name: '' }];
    }
    return [{ type: type, name: '' }];
}
// The default `metafield` type has an untyped `value` property.
// We need to create new metafield types with the labels `metafield_x` and `metafield_x_array`
// where x is the type of metafield inside the `value` property. The metafields ending with `x_array`
// is where the value is an array of type x.
const customMetafieldTypeEntries = (0, utils_1.memo)((baseMetafieldEntry) => {
    if (!baseMetafieldEntry)
        return {};
    return [
        ...new Set([...Object.values(METAFIELD_TYPE_TO_TYPE), ...theme_check_common_1.FETCHED_METAFIELD_CATEGORIES]),
    ].reduce((map, type) => {
        var _a, _b;
        {
            const metafieldEntry = JSON.parse(JSON.stringify(baseMetafieldEntry)); // easy deep clone
            const metafieldValueProp = (_a = metafieldEntry.properties) === null || _a === void 0 ? void 0 : _a.find((prop) => prop.name === 'value');
            if (metafieldValueProp) {
                metafieldValueProp.return_type = [{ type: type, name: '' }];
                metafieldValueProp.description = '';
                metafieldEntry.name = `metafield_${type}`;
                map[metafieldEntry.name] = metafieldEntry;
            }
        }
        {
            const metafieldArrayEntry = JSON.parse(JSON.stringify(baseMetafieldEntry)); // easy deep clone
            const metafieldArrayValueProp = (_b = metafieldArrayEntry.properties) === null || _b === void 0 ? void 0 : _b.find((prop) => prop.name === 'value');
            if (metafieldArrayValueProp) {
                // A metafield definition using a list of references does not use an array, but a separate type of collection.
                // For auto-completion purposes, we can't use the array type
                // https://shopify.dev/docs/api/liquid/objects/metafield#metafield-determining-the-length-of-a-list-metafield
                if (REFERENCE_TYPE_METAFIELDS.includes(type)) {
                    metafieldArrayValueProp.return_type = [{ type: 'untyped', name: '' }];
                }
                else {
                    metafieldArrayValueProp.return_type = [{ type: 'array', name: '', array_value: type }];
                }
                metafieldArrayValueProp.description = '';
                metafieldArrayEntry.name = `metafield_${type}_array`;
                map[metafieldArrayEntry.name] = metafieldArrayEntry;
            }
        }
        return map;
    }, {});
});
function schemaSettingsAsProperties(ast) {
    if (ast.type !== liquid_html_parser_1.NodeTypes.Document)
        return [];
    try {
        const source = ast._source; // (the unfixed source)
        const start = /\{%\s*schema\s*%\}/m.exec(source);
        const end = /\{%\s*endschema\s*%\}/m.exec(source);
        if (!start || !end)
            return [];
        const schema = source.slice(start.index + start[0].length, end.index);
        const json = (0, theme_check_common_1.parseJSON)(schema);
        if ((0, theme_check_common_1.isError)(json) || !('settings' in json) || !Array.isArray(json.settings))
            return [];
        const result = [];
        const inputSettings = json.settings.filter(settings_1.isInputSetting);
        for (const setting of inputSettings) {
            result.push({
                name: setting.id,
                summary: '', // TODO, this should lookup the locale file for settings... setting.label
                description: '', // TODO , this should lookup the locale file as well... setting.info,
                return_type: settingReturnType(setting),
                access: {
                    global: false,
                    parents: [],
                    template: [],
                },
            });
        }
        return result;
    }
    catch (_) {
        return [];
    }
}
//# sourceMappingURL=TypeSystem.js.map