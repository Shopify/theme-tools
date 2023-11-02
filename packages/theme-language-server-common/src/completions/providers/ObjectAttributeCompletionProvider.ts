import { NodeTypes } from '@shopify/liquid-html-parser';
import { ObjectEntry } from '@shopify/theme-check-common';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { TypeSystem, isArrayType } from '../../TypeSystem';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider, createCompletionItem, sortByName } from './common';
import { GetThemeSettingsSchemaForURI } from '../../settings';

const ArrayCoreProperties = ['size', 'first', 'last'] as const;
const StringCoreProperties = ['size'] as const;

export class ObjectAttributeCompletionProvider implements Provider {
  constructor(
    private readonly typeSystem: TypeSystem,
    private readonly getThemeSettingsSchema: GetThemeSettingsSchemaForURI,
  ) {}

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

    // Fake a VariableLookup up to the last one.
    const parentLookup = { ...node };
    parentLookup.lookups = [...parentLookup.lookups];
    parentLookup.lookups.pop();
    const parentType = await this.typeSystem.inferType(
      parentLookup,
      partialAst,
      params.textDocument.uri,
    );
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

    const objectMap = await this.typeSystem.objectMap(params.textDocument.uri, partialAst);
    const parentTypeProperties = objectMap[parentType]?.properties || [];
    return completionItems(parentTypeProperties, partial);
  }
}

function completionItems(options: ObjectEntry[], partial: string) {
  return options
    .filter(({ name }) => name.startsWith(partial))
    .sort(sortByName)
    .map(toPropertyCompletionItem);
}

function toPropertyCompletionItem(object: ObjectEntry) {
  return createCompletionItem(object, { kind: CompletionItemKind.Variable });
}
