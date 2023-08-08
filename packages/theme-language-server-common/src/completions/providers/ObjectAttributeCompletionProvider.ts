import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
  SourceCodeType,
  ThemeDocset,
  ObjectEntry,
  ReturnType,
  ArrayReturnType,
  FilterEntry,
} from '@shopify/theme-check-common';
import { Provider, createCompletionItem, sortByName } from './common';
import { CURSOR, LiquidCompletionParams } from '../params';
import { visit } from '../../visitor';
import { findLast, memo } from '../../utils';
import { LiquidExpression } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';

type LiquidTag = NodeOfType<NodeTypes.LiquidTag>;
type LiquidVariable = NodeOfType<NodeTypes.LiquidVariable>;
type LiquidVariableLookup = NodeOfType<NodeTypes.VariableLookup>;

const ArrayCoreProperties = ['size', 'first', 'last'] as const;
const StringCoreProperties = ['size'] as const;

function toPropertyCompletionItem(object: ObjectEntry) {
  return createCompletionItem(object, { kind: CompletionItemKind.Variable });
}

export class ObjectAttributeCompletionProvider implements Provider {
  constructor(private readonly themeDocset: ThemeDocset) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { partialAst, node } = params.completionContext;
    if (!node || node.type !== NodeTypes.VariableLookup) {
      return [];
    }

    if (node.lookups.length === 0) {
      // We only do lookups in this one
      return [];
    }

    const lastLookup = node.lookups.at(-1)!;
    if (lastLookup.type !== NodeTypes.String) {
      // We don't complete numbers, or variable lookups
      return [];
    }

    const partial = lastLookup.value.replace(CURSOR, '');
    const [objectMap, filtersMap, symbolsTable] = await Promise.all([
      this.objectMap(),
      this.filtersMap(),
      this.symbolsTable(partialAst),
    ]);

    // Fake a VariableLookup up to the last one.
    const parentLookup = { ...node };
    parentLookup.lookups = [...parentLookup.lookups];
    parentLookup.lookups.pop();

    const parentType = inferType(parentLookup, symbolsTable, objectMap, filtersMap);
    if (isArrayType(parentType)) {
      return completionItems(
        ArrayCoreProperties.map((name) => ({ name })),
        partial,
      );
    } else if (parentType === 'string') {
      return completionItems(
        StringCoreProperties.map((name) => ({ name })),
        partial,
      );
    }

    const parentTypeProperties = objectMap[parentType]?.properties || [];
    return completionItems(parentTypeProperties, partial);
  }

  private async symbolsTable(partialAst: LiquidHtmlNode): Promise<SymbolsTable> {
    const seedSymbolsTable = await this.seedSymbolsTable();
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
  private seedSymbolsTable = async () => {
    const globalVariables = await this.globalVariables();
    return globalVariables.reduce((table, objectEntry) => {
      table[objectEntry.name] ??= [];
      table[objectEntry.name].push({
        identifier: objectEntry.name,
        type: objectEntryType(objectEntry),
        range: [0],
      });
      return table;
    }, {} as SymbolsTable);
  };

  /**
   * An indexed representation of objects.json by name
   *
   * e.g. objectMap['product'] returns the product ObjectEntry.
   */
  private objectMap = memo(async (): Promise<ObjectMap> => {
    const entries = await this.objectEntries();
    return entries.reduce((map, entry) => {
      map[entry.name] = entry;
      return map;
    }, {} as ObjectMap);
  });

  /** An indexed representation of filters.json by name */
  private filtersMap = memo(async (): Promise<FiltersMap> => {
    const entries = await this.filterEntries();
    return entries.reduce((map, entry) => {
      map[entry.name] = entry;
      return map;
    }, {} as FiltersMap);
  });

  private filterEntries = memo(async () => {
    return this.themeDocset.filters();
  });

  private objectEntries = memo(async () => {
    return this.themeDocset.objects();
  });

  private globalVariables = memo(async () => {
    const entries = await this.objectEntries();
    return entries.filter(
      (entry) => !entry.access || entry.access.global === true || entry.access.template.length > 0,
    );
  });
}

function completionItems(options: ObjectEntry[], partial: string) {
  return options
    .filter(({ name }) => name.startsWith(partial))
    .sort(sortByName)
    .map(toPropertyCompletionItem);
}

/** An indexed representation on objects.json (by name) */
type ObjectMap = Record<ObjectEntryName, ObjectEntry>;

/** An indexed representation on objects.json (by name) */
type FiltersMap = Record<FilterEntryName, FilterEntry>;

/** An identifier refers to the name of a variable, e.g. `x`, `product`, etc. */
type Identifier = string;

type ObjectEntryName = ObjectEntry['name'];
type FilterEntryName = FilterEntry['name'];

/** A pseudo-type is what ObjectEntry return types refer to */
type PseudoType = ObjectEntryName | 'string' | 'number' | 'boolean' | 'untyped';

const Untyped = 'untyped' as const;
type Untyped = typeof Untyped;

const String = 'string' as const;
type String = typeof String;

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
type ArrayType = {
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
 * {{ x.foo | filter1 | filter2 }}
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
  const entries = visit<SourceCodeType.LiquidHtml, TypeRange>(partialAst, {
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
        range: [node.position.end, end(parentNode.blockEndPosition?.end)],
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
      }
    },
  });

  return entries
    .sort(({ range: [startA] }, { range: [startB] }) => startA - startB)
    .reduce((table, typeRange) => {
      table[typeRange.identifier] ??= [];
      table[typeRange.identifier].push(typeRange);
      return table;
    }, seedSymbolsTable);
}

function end(offset: number | undefined): number | undefined {
  if (offset === -1) return undefined;
  return offset;
}

function filterEntryReturnType(entry: FilterEntry): PseudoType | ArrayType {
  const returnTypes = entry.return_type;
  if (returnTypes && returnTypes.length > 0) {
    const returnType = returnTypes[0];
    if (isArrayReturnType(returnType)) {
      return arrayType(returnType.array_value);
    } else {
      return returnType.type;
    }
  }

  return 'string';
}

function objectEntryType(entry: ObjectEntry): PseudoType | ArrayType {
  const returnTypes = entry.return_type;
  if (returnTypes && returnTypes.length > 0) {
    const returnType = returnTypes[0];
    if (isArrayReturnType(returnType)) {
      return arrayType(returnType.array_value);
    } else {
      return returnType.type;
    }
  }

  return entry.name;
}

function inferIdentifierType(
  node: LiquidVariableLookup,
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
) {
  // The name of a variable
  const identifier = node.name;
  if (!identifier) {
    return Untyped;
  }

  const typeRanges = symbolsTable[identifier];

  // {% assign x = x.foo %}
  const typeRange = findLast(typeRanges, (tr) => isCorrectTypeRange(tr, node));

  return typeRange ? resolveType(typeRange, symbolsTable, objectMap, filtersMap) : Untyped;
}

function resolveType(
  typeRange: TypeRange,
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
): PseudoType | ArrayType {
  if (typeof typeRange.type === 'string') {
    return typeRange.type;
  }

  const type = typeRange.type;

  switch (type.kind) {
    case 'array': {
      return type;
    }

    case 'deconstructed': {
      const arrayType = inferType(type.node, symbolsTable, objectMap, filtersMap);
      if (typeof arrayType === 'string') {
        return Untyped;
      } else {
        return arrayType.valueType;
      }
    }

    default: {
      return inferType(type.node, symbolsTable, objectMap, filtersMap);
    }
  }
}

function inferType(
  thing: Identifier | LiquidExpression | LiquidVariable,
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

    // {% assign x = y.property %}
    case NodeTypes.VariableLookup: {
      return inferLookupType(thing, symbolsTable, objectMap, filtersMap);
    }

    // {% assign x = y.property | filter1 | filter2 %}
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

function isArrayReturnType(rt: ReturnType): rt is ArrayReturnType {
  return rt.type === 'array';
}

function isArrayType(thing: PseudoType | ArrayType): thing is ArrayType {
  return typeof thing !== 'string';
}

/** Assumes findLast */
function isCorrectTypeRange(typeRange: TypeRange, node: LiquidVariableLookup): boolean {
  const [start, end] = typeRange.range;
  if (end && node.position.start > end) return false;
  return node.position.start > start;
}

function inferLookupType(
  thing: LiquidVariableLookup,
  symbolsTable: SymbolsTable,
  objectMap: ObjectMap,
  filtersMap: FiltersMap,
) {
  // we return the type of the drop, so a.b.c
  const node = thing;
  if (node.name === null) return Untyped;

  let curr = inferIdentifierType(node, symbolsTable, objectMap, filtersMap);

  for (let lookup of node.lookups) {
    // This part infers the type of a lookup on an ArrayType
    // - images[0] becomes 'image'
    // - images[index] becomes 'image'
    // - images.first becomes 'image'
    // - images.last becomes 'image'
    // - images.size becomes 'number'
    // - anything else becomes 'untyped'
    if (isArrayType(curr)) {
      if (lookup.type === NodeTypes.Number || lookup.type === NodeTypes.VariableLookup) {
        curr = curr.valueType;
      } else if (lookup.type === NodeTypes.String) {
        switch (lookup.value) {
          // images.first
          case 'first':
          case 'last': {
            curr = curr.valueType;
            break;
          }

          // images.size
          case 'size': {
            curr = 'number';
            break;
          }

          default: {
            return Untyped;
          }
        }
      } else {
        return Untyped;
      }

      continue;
    }

    const entry: ObjectEntry | undefined = objectMap[curr];
    if (!entry || lookup.type !== NodeTypes.String) {
      return Untyped;
    }

    const lookupName = lookup.value;
    const property = entry.properties?.find((property) => property.name === lookupName);

    if (!property) return Untyped;

    curr = objectEntryType(property);

    if (curr === Untyped) return Untyped;
  }

  return curr;
}
