import {
  AppBlockSchema,
  deepGet,
  isError,
  SectionSchema,
  ThemeBlockSchema,
  ThemeSchemaType,
} from '@shopify/theme-check-common';
import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { CompletionItemKind } from 'vscode-languageserver-protocol';
import { isLiquidRequestContext, RequestContext } from '../../RequestContext';
import { isSectionOrBlockFile } from '../../utils';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import { GetThemeBlockNames } from '../../JSONContributions';

/**
 * The BlockTypeCompletionProvider offers value completions of the
 * `blocks.[].type` property inside section and theme block `{% schema %}` tags.
 *
 * @example
 * {% schema %}
 * {
 *   "blocks": [
 *     { "type": "█" },
 *   ]
 * }
 * {% endschema %}
 */
export class BlockTypeCompletionProvider implements JSONCompletionProvider {
  constructor(private getThemeBlockNames: GetThemeBlockNames) {}

  async completeValue(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]> {
    if (
      !isSectionOrBlockFile(context.doc.uri) ||
      !isLiquidRequestContext(context) ||
      !isBlockDefinitionPath(path)
    ) {
      return [];
    }
    const { doc } = context;
    const schema = await doc.getSchema();

    // Can't complete if we can't parse the schema
    if (!schema || isError(schema.parsed) || !isSectionOrBlockSchema(schema)) {
      return [];
    }

    // Local blocks have their type defined in the schema, there's nothing to complete
    if (hasLocalBlockDefinitions(schema)) return [];

    const blockNames = await this.getThemeBlockNames(doc.uri, true);

    return createBlockNameCompletionItems(blockNames);
  }
}

export function createBlockNameCompletionItems(blockNames: string[]) {
  return blockNames.map((name) => ({
    kind: CompletionItemKind.Value,
    label: `"${name}"`,
    insertText: `"${name}"`,
  }));
}

export function isBlockDefinitionPath(path: JSONPath) {
  return path.at(0) === 'blocks';
}

export function isPresetBlockPath(path: JSONPath) {
  return path.at(0) === 'presets';
}

export function isBlockTypePath(path: JSONPath) {
  // We have these cases to support:
  // - top level blocks.[].type
  // - presets.[](recursive .blocks.[].type)
  // - presets.[](recursive .blocks.{}.type)
  const topLevel = path.at(0);
  if (topLevel !== 'blocks' && topLevel !== 'presets') return false;
  if (path.length < 4) return false; // minimum path length
  const [shouldBeBlocks, _idOrIndex, shouldBeType] = path.slice(-3);
  return shouldBeBlocks === 'blocks' && shouldBeType === 'type';
}

export function hasLocalBlockDefinitions(schema: SectionSchema | ThemeBlockSchema) {
  if (schema.type !== ThemeSchemaType.Section || isError(schema.parsed)) return false;
  const blocks = deepGet(schema.parsed, ['blocks']);
  if (!blocks || !Array.isArray(blocks)) return false;
  return blocks.some((block) => block && block.name !== undefined);
}

export function isLocalBlockDefinition(
  schema: ThemeBlockSchema | SectionSchema,
  blockTypePath: JSONPath,
) {
  if (schema.type !== ThemeSchemaType.Section) return false;
  const blockNamePath = [...blockTypePath.slice(0, -1), 'name'];
  const name = deepGet(schema.parsed, blockNamePath);
  return name !== undefined;
}

const SectionOrBlockSchemaTypes = [ThemeSchemaType.Section, ThemeSchemaType.Block];
export function isSectionOrBlockSchema(
  schema: SectionSchema | ThemeBlockSchema | AppBlockSchema,
): schema is SectionSchema | ThemeBlockSchema {
  return SectionOrBlockSchemaTypes.includes(schema.type);
}
