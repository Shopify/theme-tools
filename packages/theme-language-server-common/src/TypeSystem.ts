import {
  AssignMarkup,
  LiquidExpression,
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagDecrement,
  LiquidTagIncrement,
  LiquidVariable,
  LiquidVariableLookup,
  NamedTags,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import {
  ArrayReturnType,
  DocsetEntry,
  FilterEntry,
  ObjectEntry,
  ReturnType,
  SourceCodeType,
  ThemeDocset,
} from '@shopify/theme-check-common';
import { findLast, memo, toAbsolutePath } from './utils';
import { visit } from './visitor';
import {
  GetThemeSettingsSchemaForURI,
  InputSetting,
  isInputSetting,
  isSettingsCategory,
} from './settings';

export class TypeSystem {
  constructor(
    private readonly themeDocset: ThemeDocset,
    private readonly getThemeSettingsSchemaForURI: GetThemeSettingsSchemaForURI,
  ) {}

  async inferType(
    thing: Identifier | LiquidExpression | LiquidVariable | AssignMarkup,
    partialAst: LiquidHtmlNode,
    uri: string,
  ): Promise<PseudoType | ArrayType> {
    const [objectMap, filtersMap, symbolsTable] = await Promise.all([
      this.objectMap(uri, partialAst),
      this.filtersMap(),
      this.symbolsTable(partialAst, uri),
    ]);

    return inferType(thing, symbolsTable, objectMap, filtersMap);
  }

  async availableVariables(
    partialAst: LiquidHtmlNode,
    partial: string,
    node: LiquidVariableLookup,
    uri: string,
  ): Promise<{ entry: DocsetEntry; type: PseudoType | ArrayType }[]> {
    const [objectMap, filtersMap, symbolsTable] = await Promise.all([
      this.objectMap(uri, partialAst),
      this.filtersMap(),
      this.symbolsTable(partialAst, uri),
    ]);

    return Object.entries(symbolsTable)
      .filter(
        ([key, typeRanges]) =>
          key.startsWith(partial) &&
          typeRanges.some((typeRange) => isCorrectTypeRange(typeRange, node)),
      )
      .map(([identifier, typeRanges]) => {
        const typeRange = findLast(typeRanges, (typeRange) => isCorrectTypeRange(typeRange, node))!;
        const type = resolveTypeRangeType(typeRange.type, symbolsTable, objectMap, filtersMap);
        const entry = objectMap[isArrayType(type) ? type.valueType : type] ?? {};
        return {
          entry: { ...entry, name: identifier },
          type,
        };
      });
  }

  public async themeSettingProperties(uri: string): Promise<ObjectEntry[]> {
    const themeSettingsSchema = await this.getThemeSettingsSchemaForURI(uri);
    const categories = themeSettingsSchema.filter(isSettingsCategory);
    const result: ObjectEntry[] = [];
    for (const category of categories) {
      const inputSettings = category.settings.filter(isInputSetting);
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

  /**
   * An indexed representation of objects.json by name
   *
   * e.g. objectMap['product'] returns the product ObjectEntry.
   */
  public objectMap = async (uri: string, ast: LiquidHtmlNode): Promise<ObjectMap> => {
    const [objectMap, themeSettingProperties] = await Promise.all([
      this._objectMap(),
      this.themeSettingProperties(uri),
    ]);

    // Here we shallow mutate `settings.properties` to have the properties made
    // available by settings_schema.json
    const result: ObjectMap = {
      ...objectMap,
      settings: {
        ...(objectMap.settings ?? {}),
        properties: themeSettingProperties,
      },
    };

    // Deal with sections/file.liquid section.settings by infering the type from the {% schema %}
    if (/[\/\\]sections[\/\\]/.test(uri) && result.section) {
      result.section = JSON.parse(JSON.stringify(result.section)); // easy deep clone
      const settings = result.section.properties?.find((x) => x.name === 'settings');
      if (!settings || !settings.return_type) return result;
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
      const settings = result.block.properties?.find((x) => x.name === 'settings');
      if (!settings || !settings.return_type) return result;
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

  // This is the big one we reuse (memoized)
  private _objectMap = memo(async (): Promise<ObjectMap> => {
    const entries = await this.objectEntries();
    return entries.reduce((map, entry) => {
      map[entry.name] = entry;
      return map;
    }, {} as ObjectMap);
  });

  /** An indexed representation of filters.json by name */
  public filtersMap = memo(async (): Promise<FiltersMap> => {
    const entries = await this.filterEntries();
    return entries.reduce((map, entry) => {
      map[entry.name] = entry;
      return map;
    }, {} as FiltersMap);
  });

  public filterEntries = memo(async () => {
    return this.themeDocset.filters();
  });

  public objectEntries = memo(async () => {
    return this.themeDocset.objects();
  });

  private async symbolsTable(partialAst: LiquidHtmlNode, uri: string): Promise<SymbolsTable> {
    const seedSymbolsTable = await this.seedSymbolsTable(uri);
    return buildSymbolsTable(partialAst, seedSymbolsTable);
  }

  /**
   * The seedSymbolsTable contains all the global variables.
   *
   * This lets us have the ambient type of things first, but if someone
   * reassigns product, then we'll be able to change the type of product on
   * the appropriate range.
   *
   * This is not memo'ed because we would otherwise need to clone the thing.
   */
  private seedSymbolsTable = async (uri: string) => {
    const [globalVariables, contextualVariables] = await Promise.all([
      this.globalVariables(),
      this.contextualVariables(uri),
    ]);
    return globalVariables.concat(contextualVariables).reduce((table, objectEntry) => {
      table[objectEntry.name] ??= [];
      table[objectEntry.name].push({
        identifier: objectEntry.name,
        type: objectEntryType(objectEntry),
        range: [0],
      });
      return table;
    }, {} as SymbolsTable);
  };

  private globalVariables = memo(async () => {
    const entries = await this.objectEntries();
    return entries.filter(
      (entry) => !entry.access || entry.access.global === true || entry.access.template.length > 0,
    );
  });

  private contextualVariables = async (uri: string) => {
    const entries = await this.objectEntries();
    const contextualEntries = getContextualEntries(uri);
    return entries.filter((entry) => contextualEntries.includes(entry.name));
  };
}

const SECTION_FILE_REGEX = /sections[\/\\][^.\\\/]*\.liquid$/;
const BLOCK_FILE_REGEX = /blocks[\/\\][^.\\\/]*\.liquid$/;
const SNIPPET_FILE_REGEX = /snippets[\/\\][^.\\\/]*\.liquid$/;

function getContextualEntries(uri: string): string[] {
  const absolutePath = toAbsolutePath(uri);
  if (SECTION_FILE_REGEX.test(absolutePath)) {
    return ['section', 'predictive_search', 'recommendations'];
  }
  if (BLOCK_FILE_REGEX.test(absolutePath)) {
    return ['app', 'section', 'block'];
  }
  if (SNIPPET_FILE_REGEX.test(absolutePath)) {
    return ['app'];
  }
  return [];
}

/** An indexed representation on objects.json (by name) */
type ObjectMap = Record<ObjectEntryName, ObjectEntry>;

/** An indexed representation on filters.json (by name) */
type FiltersMap = Record<FilterEntryName, FilterEntry>;

/** An identifier refers to the name of a variable, e.g. `x`, `product`, etc. */
type Identifier = string;

type ObjectEntryName = ObjectEntry['name'];
type FilterEntryName = FilterEntry['name'];

const Untyped = 'untyped' as const;
type Untyped = typeof Untyped;

const String = 'string' as const;
type String = typeof String;

/** A pseudo-type is the possible values of an ObjectEntry's return_type.type */
export type PseudoType = ObjectEntryName | String | Untyped | 'number' | 'boolean';

/**
 * A variable can have many types in the same file
 *
 * Just think of this:
 *
 *   {{ x }} # unknown
 *   {% assign x = all_products['cool-handle'] %}
 *   {{ x }} # product
 *   {% assign x = x.featured_image %}
 *   {{ x }} # image
 *   [% assign x = x.src %}]
 *   {{ x }} # string
 */
interface TypeRange {
  /** The name of the variable */
  identifier: Identifier;

  /** The type of the variable */
  type: PseudoType | ArrayType | LazyVariableType | LazyDeconstructedExpression;

  /**
   * The range may be one of two things:
   *  - open ended (till end of file, end === undefined)
   *  - closed (inside for loop)
   */
  range: [start: number, end?: number];
}

/** Some things can be an array type (e.g. product.images) */
export type ArrayType = {
  kind: 'array';
  valueType: PseudoType;
};
const arrayType = (valueType: PseudoType): ArrayType => ({
  kind: 'array',
  valueType,
});

/**
 * Because a type may depend on another, this represents the type of
 * something as the type of a LiquidVariable chain.
 * {% assign x = y.foo | filter1 | filter2 %}
 */
type LazyVariableType = {
  kind: NodeTypes.LiquidVariable;
  node: LiquidVariable;
  offset: number;
};
const lazyVariable = (node: LiquidVariable, offset: number): LazyVariableType => ({
  kind: NodeTypes.LiquidVariable,
  node,
  offset,
});

/**
 * A thing may be the deconstruction of something else.
 *
 * examples
 * - for thing in (0..2)
 * - for thing in collection
 * - for thing in parent.collection
 * - for thing in 'string?'
 */
type LazyDeconstructedExpression = {
  kind: 'deconstructed';
  node: LiquidExpression;
  offset: number;
};
const LazyDeconstructedExpression = (
  node: LiquidExpression,
  offset: number,
): LazyDeconstructedExpression => ({
  kind: 'deconstructed',
  node,
  offset,
});

/**
 * A symbols table is a map of identifiers to TypeRanges.
 *
 * It stores the mapping of variable name to type by position in the file.
 *
 * The ranges are sorted in range.start order.
 */
type SymbolsTable = Record<Identifier, TypeRange[]>;

function buildSymbolsTable(
  partialAst: LiquidHtmlNode,
  seedSymbolsTable: SymbolsTable,
): SymbolsTable {
  const typeRanges = visit<SourceCodeType.LiquidHtml, TypeRange>(partialAst, {
    // {% assign x = foo.x | filter %}
    AssignMarkup(node) {
      return {
        identifier: node.name,
        type: lazyVariable(node.value, node.position.start),
        range: [node.position.end],
      };
    },

    // This also covers tablerow
    ForMarkup(node, ancestors) {
      const parentNode = ancestors.at(-1)! as LiquidTag;
      return {
        identifier: node.variableName,
        type: LazyDeconstructedExpression(node.collection, node.position.start),
        range: [parentNode.blockStartPosition.end, end(parentNode.blockEndPosition?.end)],
      };
    },

    // {% capture foo %}
    //   ...
    // {% endcapture}
    LiquidTag(node) {
      if (node.name === 'capture' && typeof node.markup !== 'string') {
        return {
          identifier: node.markup.name!,
          type: String,
          range: [node.position.end],
        };
      } else if (['form', 'paginate'].includes(node.name)) {
        return {
          identifier: node.name,
          type: node.name,
          range: [node.blockStartPosition.end, end(node.blockEndPosition?.end)],
        };
      } else if (['for', 'tablerow'].includes(node.name)) {
        return {
          identifier: node.name + 'loop',
          type: node.name + 'loop',
          range: [node.blockStartPosition.end, end(node.blockEndPosition?.end)],
        };
      } else if (isLiquidTagIncrement(node) || isLiquidTagDecrement(node)) {
        if (node.markup.name === null) return;
        return {
          identifier: node.markup.name,
          type: 'number',
          range: [node.position.start],
        };
      } else if (node.name === 'layout') {
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
      table[typeRange.identifier] ??= [];
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
function resolveTypeRangeType(
  typeRangeType: TypeRange['type'],
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
): PseudoType | ArrayType {
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
        return Untyped;
      } else {
        return arrayType.valueType;
      }
    }

    default: {
      return inferType(typeRangeType.node, symbolsTable, objectMap, filtersMap);
    }
  }
}

function inferType(
  thing: Identifier | LiquidExpression | LiquidVariable | AssignMarkup,
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
): PseudoType | ArrayType {
  if (typeof thing === 'string') {
    return objectMap[thing as PseudoType]?.name ?? Untyped;
  }

  switch (thing.type) {
    case NodeTypes.Number: {
      return 'number';
    }

    case NodeTypes.String: {
      return 'string';
    }

    case NodeTypes.LiquidLiteral: {
      return 'boolean';
    }

    case NodeTypes.Range: {
      return arrayType('number');
    }

    // The type of the assign markup is the type of the right hand side.
    // {% assign x = y.property | filter1 | filter2 %}
    case NodeTypes.AssignMarkup: {
      return inferType(thing.value, symbolsTable, objectMap, filtersMap);
    }

    // A variable lookup is expression[.lookup]*
    // {{ y.property }}
    case NodeTypes.VariableLookup: {
      return inferLookupType(thing, symbolsTable, objectMap, filtersMap);
    }

    // A variable is the VariableLookup + Filters
    // The type is the return value of the last filter
    // {{ y.property | filter1 | filter2 }}
    case NodeTypes.LiquidVariable: {
      if (thing.filters.length > 0) {
        const lastFilter = thing.filters.at(-1)!;
        const filterEntry = filtersMap[lastFilter.name];
        return filterEntry ? filterEntryReturnType(filterEntry) : Untyped;
      } else {
        return inferType(thing.expression, symbolsTable, objectMap, filtersMap);
      }
    }

    default: {
      return Untyped;
    }
  }
}

function inferLookupType(
  thing: LiquidVariableLookup,
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
): PseudoType | ArrayType {
  // we return the type of the drop, so a.b.c
  const node = thing;

  // We don't complete global lookups. It's too much of an edge case.
  if (node.name === null) return Untyped;

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
    if (curr === Untyped) {
      return Untyped;
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
function inferIdentifierType(
  node: LiquidVariableLookup,
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
) {
  // The name of a variable
  const identifier = node.name;

  // We don't complete the global access edge case
  // e.g. {{ ['all_products'] }}
  if (!identifier) {
    return Untyped;
  }

  const typeRanges = symbolsTable[identifier];
  if (!typeRanges) {
    return Untyped;
  }

  const typeRange = findLast(typeRanges, (tr) => isCorrectTypeRange(tr, node));

  return typeRange
    ? resolveTypeRangeType(typeRange.type, symbolsTable, objectMap, filtersMap)
    : Untyped;
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
function inferArrayTypeLookupType(curr: ArrayType, lookup: LiquidExpression) {
  // images[0]
  // images[index]
  if (lookup.type === NodeTypes.Number || lookup.type === NodeTypes.VariableLookup) {
    return curr.valueType;
  }
  // images.first
  // images.last
  // images.size
  // anything else is undef
  else if (lookup.type === NodeTypes.String) {
    switch (lookup.value) {
      case 'first':
      case 'last': {
        return curr.valueType;
      }

      case 'size': {
        return 'number';
      }

      default: {
        return Untyped;
      }
    }
  }
  // images[true]
  // images[(0..2)]
  else {
    return Untyped;
  }
}

function inferPseudoTypePropertyType(
  curr: PseudoType, // settings
  lookup: LiquidExpression,
  objectMap: ObjectMap,
) {
  const parentEntry: ObjectEntry | undefined = objectMap[curr];

  // products[0]
  // products[true]
  // products[(0..10)]
  // unknown.images
  if (!parentEntry || lookup.type !== NodeTypes.String) {
    return Untyped;
  }

  const propertyName = lookup.value;

  const property = parentEntry.properties?.find((property) => property.name === propertyName);
  if (!property) {
    return Untyped;
  }

  return objectEntryType(property);
}

function filterEntryReturnType(entry: FilterEntry): PseudoType | ArrayType {
  return docsetEntryReturnType(entry, 'string');
}

function objectEntryType(entry: ObjectEntry): PseudoType | ArrayType {
  return docsetEntryReturnType(entry, entry.name);
}

/**
 * This function converts the return_type property in one of the .json
 * files into a PseudoType or ArrayType.
 */
export function docsetEntryReturnType(
  entry: ObjectEntry | FilterEntry,
  defaultValue: PseudoType,
): PseudoType | ArrayType {
  const returnTypes = entry.return_type;
  if (returnTypes && returnTypes.length > 0) {
    const returnType = returnTypes[0];
    if (isArrayReturnType(returnType)) {
      return arrayType(returnType.array_value);
    } else {
      return returnType.type;
    }
  }

  return defaultValue;
}

function isArrayReturnType(rt: ReturnType): rt is ArrayReturnType {
  return rt.type === 'array';
}

export function isArrayType(thing: PseudoType | ArrayType): thing is ArrayType {
  return typeof thing !== 'string';
}

/** Assumes findLast */
function isCorrectTypeRange(typeRange: TypeRange, node: LiquidVariableLookup): boolean {
  const [start, end] = typeRange.range;
  if (end && node.position.start > end) return false;
  return node.position.start > start;
}

function end(offset: number | undefined): number | undefined {
  if (offset === -1) return undefined;
  return offset;
}

function isLiquidTagIncrement(node: LiquidTag): node is LiquidTagIncrement {
  return node.name === NamedTags.increment && typeof node.markup !== 'string';
}

function isLiquidTagDecrement(node: LiquidTag): node is LiquidTagDecrement {
  return node.name === NamedTags.decrement && typeof node.markup !== 'string';
}

function settingReturnType(setting: InputSetting): ObjectEntry['return_type'] {
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

function schemaSettingsAsProperties(ast: LiquidHtmlNode): ObjectEntry[] {
  if (ast.type !== NodeTypes.Document) return [];
  try {
    const source = ast._source; // (the unfixed source)
    const start = /\{%\s*schema\s*%\}/m.exec(source);
    const end = /\{%\s*endschema\s*%\}/m.exec(source);
    if (!start || !end) return [];
    const schema = source.slice(start.index + start[0].length, end.index);
    const json = JSON.parse(schema);
    if (!('settings' in json) || !Array.isArray(json.settings)) return [];
    const result: ObjectEntry[] = [];
    const inputSettings = json.settings.filter(isInputSetting);
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
  } catch (_) {
    return [];
  }
}
