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
} from '@shopify/theme-check-common';
import { Provider, createCompletionItem, sortByName } from './common';
import { CURSOR, LiquidCompletionParams } from '../params';
import { visit } from '../../visitor';
import { findLast, memo } from '../../utils';

type LiquidTag = NodeOfType<NodeTypes.LiquidTag>;
type LiquidVariable = NodeOfType<NodeTypes.LiquidVariable>;
type LiquidVariableLookup = NodeOfType<NodeTypes.VariableLookup>;

const ArrayTypeOptions = ['empty?', 'size', 'first', 'last'];

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
    const [symbolsMap, seedSymbolsTable] = await Promise.all([
      this.symbolsMap(),
      this.seedSymbolsTable(),
    ]);

    const symbolsTable = buildSymbolsTable(partialAst, seedSymbolsTable);

    // Fake a VaraiableLookup up to the last one.
    const parentLookup = { ...node };
    parentLookup.lookups = [...parentLookup.lookups];
    parentLookup.lookups.pop();

    const parentType = inferType(parentLookup, symbolsTable, symbolsMap);
    if (isArrayType(parentType)) {
      return ArrayTypeOptions.filter((name) => name.startsWith(partial))
        .map((name) => ({ name }))
        .map(toPropertyCompletionItem);
    }

    const options = symbolsMap[parentType]?.properties || [];

    return options
      .filter(({ name }) => name.startsWith(partial))
      .sort(sortByName)
      .map(toPropertyCompletionItem);
  }

  private objectEntries = memo(async () => {
    return this.themeDocset.objects();
  });

  private globalVariables = memo(async () => {
    const entries = await this.objectEntries();
    return entries.filter(
      (entry) => !entry.access || entry.access.global === true || entry.access.template.length > 0,
    );
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
   * e.g. symbolsMap['product'] returns the product ObjectEntry.
   */
  private symbolsMap = memo(async (): Promise<SymbolsMap> => {
    const entries = await this.objectEntries();
    return entries.reduce((map, entry) => {
      map[entry.name] = entry;
      return map;
    }, {} as SymbolsMap);
  });
}

/** An indexed representation on objects.json (by name) */
type SymbolsMap = Record<ObjectEntryName, ObjectEntry>;

/** An identifier refers to the name of a variable, e.g. `x`, `product`, etc. */
type Identifier = string;

/** Object entries also declare the type of things */
type ObjectEntryName = ObjectEntry['name'];

/** A pseudo-type is what ObjectEntry return types refer to */
type PseudoType = ObjectEntryName | 'string' | 'number' | 'boolean' | 'untyped';

/** Some things can be an array type (e.g. product.images) */
type ArrayType = {
  type: 'array';
  array_value: PseudoType;
};

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
  /**
   * The name of the variable
   */
  identifier: Identifier;

  /**
   * The type of the variable
   */
  type: PseudoType | ArrayType | LazyVariableLookupType | LazyVariableType;

  /**
   * The range may be one of two things:
   *  - open ended (till end of file, end === undefined)
   *  - closed (inside for loop)
   */
  range: [start: number, end?: number];
}

/**
 * Because a type may depend on another, this represents the type of
 * something as the type of some other lookup.
 */
type LazyVariableLookupType = {
  type: NodeTypes.VariableLookup;
  node: LiquidVariableLookup;
  offset: number;
};

/**
 * Because a type may depend on another, this represents the type of
 * something as the type of a LiquidVariable chain.
 * {{ x.foo | filter1 | filter2 }}
 */
type LazyVariableType = {
  type: NodeTypes.LiquidVariable;
  node: LiquidVariable;
  offset: number;
};

/**
 * A symbols table is a map of identifiers to TypeRanges.
 *
 * It stores the mapping of variable name to type by position in the file.
 *
 * The ranges are sorted in range.start order.
 */
type SymbolsTable = Record<Identifier, TypeRange[]>;

const lazyVariable = (node: LiquidVariable, offset: number): LazyVariableType => ({
  type: NodeTypes.LiquidVariable,
  node,
  offset,
});

const lazyLookup = (node: LiquidVariableLookup, offset: number): LazyVariableLookupType => ({
  type: NodeTypes.VariableLookup,
  node,
  offset,
});

// const lazyArrayLookup = (
//   node: LiquidVariableLookup,
//   offset: number,
// )
//
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
        type: lazyLookup(node.collection as LiquidVariableLookup, node.position.start),
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

function objectEntryType(entry: ObjectEntry): PseudoType | ArrayType {
  const returnTypes = entry.return_type;
  if (returnTypes && returnTypes.length > 0) {
    const returnType = returnTypes[0];
    if (isArrayReturnType(returnType)) {
      return {
        type: 'array',
        array_value: returnType.array_value,
      };
    } else {
      return returnType.type;
    }
  }

  return entry.name;
}

function inferIdentifierType(
  node: LiquidVariableLookup,
  symbolsTable: SymbolsTable,
  symbolsMap: SymbolsMap,
) {
  // The name of a variable
  const identifier = node.name;
  if (!identifier) {
    return Untyped;
  }

  const typeRanges = symbolsTable[identifier];

  // {% assign x = x.foo %}
  const typeRange = findLast(typeRanges, (tr) => isCorrectTypeRange(tr, node));

  return typeRange ? resolveType(typeRange, symbolsTable, symbolsMap) : Untyped;
}

function resolveType(
  typeRange: TypeRange,
  symbolsTable: SymbolsTable,
  symbolsMap: SymbolsMap,
): PseudoType | ArrayType {
  if (typeof typeRange.type === 'string' || typeRange.type.type === 'array') {
    return typeRange.type;
  } else {
    return inferType(typeRange.type.node, symbolsTable, symbolsMap);
  }
}

function inferType(
  thing: Identifier | LiquidVariableLookup | LiquidVariable,
  symbolsTable: SymbolsTable,
  symbolsMap: SymbolsMap,
): PseudoType | ArrayType {
  if (typeof thing === 'string') {
    return symbolsMap[thing as PseudoType]?.name ?? Untyped;
  }

  // {% assign x = y.property %}
  if (
    thing.type === NodeTypes.LiquidVariable &&
    thing.filters.length === 0 &&
    thing.expression.type === NodeTypes.VariableLookup
  ) {
    return inferType(thing.expression, symbolsTable, symbolsMap);
  }

  if (thing.type === NodeTypes.VariableLookup) {
    // we return the type of the drop, so a.b.c
    const node = thing;
    if (node.name === null) return Untyped;

    let curr = inferIdentifierType(node, symbolsTable, symbolsMap);

    for (let lookup of node.lookups) {
      // This part infers the type of a lookup on an ArrayType
      // - images[0] becomes 'image'
      // - images[index] becomes 'image'
      // - images.first becomes 'image'
      // - images.last becomes 'image'
      // - images.empty? becomes 'boolean'
      // - images.size becomes 'number'
      // - anything else becomes 'untyped'
      if (isArrayType(curr)) {
        if (lookup.type === NodeTypes.Number || lookup.type === NodeTypes.VariableLookup) {
          curr = curr.array_value;
        } else if (lookup.type === NodeTypes.String) {
          switch (lookup.value) {
            // images.empty?
            case 'empty?': {
              curr = 'boolean';
              break;
            }

            // images.first
            case 'first':
            case 'last': {
              curr = curr.array_value;
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

      const entry: ObjectEntry | undefined = symbolsMap[curr];
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

  return Untyped;
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
