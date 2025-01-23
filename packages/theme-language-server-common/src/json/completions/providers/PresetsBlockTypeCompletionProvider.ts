import { deepGet, isError } from '@shopify/theme-check-common';
import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { isLiquidRequestContext, RequestContext } from '../../RequestContext';
import { isSectionOrBlockFile } from '../../utils';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import {
  createBlockNameCompletionItems,
  isSectionOrBlockSchema,
} from './BlockTypeCompletionProvider';
import { GetThemeBlockNames, GetThemeBlockSchema } from '../../JSONContributions';

/**
 * The PresetsBlockTypeCompletionProvider offers value completions of the
 * `presets.[](recursive .blocks.[]).type` keys inside section and theme block `{% schema %}` tags.
 *
 * @example
 * {% schema %}
 * {
 *   "presets": [
 *     {
 *       "blocks": [
 *         { "type": "█" },
 *       ]
 *     },
 *   ]
 * }
 * {% endschema %}
 */
export class PresetsBlockTypeCompletionProvider implements JSONCompletionProvider {
  constructor(
    private getThemeBlockNames: GetThemeBlockNames,
    private getThemeBlockSchema: GetThemeBlockSchema,
  ) {}

  async completeValue(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]> {
    if (
      !isSectionOrBlockFile(context.doc.uri) ||
      !isLiquidRequestContext(context) ||
      !isPresetBlockPath(path)
    ) {
      return [];
    }

    const { doc } = context;
    const schema = await doc.getSchema();

    if (!schema || isError(schema.parsed) || !isSectionOrBlockSchema(schema)) {
      return [];
    }

    let parsedBlockSchema = schema.parsed;

    if (isNestedBlockPath(path)) {
      const parentBlockName = getParentBlockName(schema.parsed, path);
      if (!parentBlockName) {
        return [];
      }

      const parentBlockSchema = await this.getThemeBlockSchema(doc.uri, parentBlockName);

      if (
        !parentBlockSchema ||
        isError(parentBlockSchema.parsed) ||
        !isSectionOrBlockSchema(parentBlockSchema)
      ) {
        return [];
      }

      parsedBlockSchema = parentBlockSchema.parsed;
    }

    const blocks: { type: string }[] = parsedBlockSchema.blocks || [];

    const blockGroups = {
      themeBlocks: false,
      specificBlockNames: [] as string[],
    };

    blocks.forEach((block) => {
      if (block.type === '@theme') {
        blockGroups.themeBlocks = true;
      } else if (!block.type.startsWith('@')) {
        blockGroups.specificBlockNames.push(block.type);
      }
    });

    let blockNames = blockGroups.specificBlockNames;

    if (blockGroups.themeBlocks) {
      blockNames.push(...(await this.getThemeBlockNames(doc.uri, false)));
    }

    return createBlockNameCompletionItems(blockNames);
  }
}

// `blocks` can be nested within other `blocks`
// We need to ensure the last leg of the path is { "blocks": [{ "type": "█" }] }
function isPresetBlockPath(path: JSONPath) {
  return path.at(0) === 'presets' && path.at(-3) === 'blocks' && path.at(-1) === 'type';
}

function isNestedBlockPath(path: JSONPath) {
  return path.at(-5) === 'blocks' && path.at(-3) === 'blocks' && path.at(-1) === 'type';
}

function getParentBlockName(parsedSchema: any, path: JSONPath) {
  return deepGet(parsedSchema, [...path.slice(0, -3), 'type']);
}
