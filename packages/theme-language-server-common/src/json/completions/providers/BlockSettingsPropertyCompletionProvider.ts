import { JSONPath } from 'vscode-json-languageservice';
import { GetThemeBlockSchema } from '../../JSONContributions';
import { RequestContext } from '../../RequestContext';
import { JSONCompletionItem, JSONCompletionProvider } from '../JSONCompletionProvider';
import { isBlockFile, isSectionFile } from '../../utils';
import { deepGet, isError, SourceCodeType } from '@shopify/theme-check-common';
import { isSectionOrBlockSchema } from './BlockTypeCompletionProvider';
import { GetTranslationsForURI } from '../../../translations';
import { schemaSettingsPropertyCompletionItems } from './helpers/schemaSettings';

/**
 * The BlockSettingsPropertyCompletionProvider offers value completions of the
 * `presets.[].(recursive blocks.[]).settings` keys and `defaults.blocks.[].settings` keys inside
 * `{% schema %}` tags.
 *
 * @example
 * {% schema %}
 * {
 *   "presets": [
 *     {
 *       "blocks": [
 *         {
 *           "type": "block-type",
 *           "settings": {
 *             "█"
 *           }
 *         },
 *       ]
 *     },
 *   ],
 *   "default": {
 *     "blocks": [
 *       {
 *         "type": "block-type",
 *         "settings": {
 *           "█"
 *         }
 *       },
 *     ]
 *   }
 * }
 * {% endschema %}
 */
export class BlockSettingsPropertyCompletionProvider implements JSONCompletionProvider {
  constructor(
    private getDefaultSchemaTranslations: GetTranslationsForURI,
    private getThemeBlockSchema: GetThemeBlockSchema,
  ) {}

  async completeProperty(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]> {
    const { doc } = context;

    if (doc.type !== SourceCodeType.LiquidHtml) return [];

    // section files can have schemas with `presets` and `default`
    // block files can have schemas with `presets` only
    if (
      !(
        isSectionFile(doc.uri) &&
        (isPresetsBlocksSettingsPath(path) || isDefaultBlocksSettingsPath(path))
      ) &&
      !(isBlockFile(doc.uri) && isPresetsBlocksSettingsPath(path))
    ) {
      return [];
    }

    if (isSectionFile(doc.uri) && !isDefaultBlocksSettingsPath(path)) {
    }

    const schema = await doc.getSchema();

    if (!schema || !isSectionOrBlockSchema(schema) || isError(schema.parsed)) {
      return [];
    }

    const blockType = deepGet(schema.parsed, [...path.slice(0, -1), 'type']);

    if (!blockType) {
      return [];
    }

    const blockOriginSchema = await this.getThemeBlockSchema(doc.uri, blockType);

    if (
      !blockOriginSchema ||
      isError(blockOriginSchema.parsed) ||
      !isSectionOrBlockSchema(blockOriginSchema)
    ) {
      return [];
    }

    if (!blockOriginSchema.parsed?.settings || !Array.isArray(blockOriginSchema.parsed?.settings)) {
      return [];
    }

    const translations = await this.getDefaultSchemaTranslations(doc.textDocument.uri);

    return schemaSettingsPropertyCompletionItems(blockOriginSchema.parsed, translations);
  }
}

// `blocks` can be nested within other `blocks`
// We need to ensure the last leg of the path is { "blocks": [{ "settings": { "█" } }] }
function isPresetsBlocksSettingsPath(path: JSONPath) {
  return path.at(0) === 'presets' && path.at(-3) === 'blocks' && path.at(-1) === 'settings';
}

// `blocks` inside `default` can't be nested within other `blocks`
function isDefaultBlocksSettingsPath(path: JSONPath) {
  return path.at(0) === 'default' && path.at(1) === 'blocks' && path.at(3) === 'settings';
}
