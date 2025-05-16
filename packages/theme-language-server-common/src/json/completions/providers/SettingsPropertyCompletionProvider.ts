import { isError, SourceCodeType } from '@shopify/theme-check-common';
import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { RequestContext } from '../../RequestContext';
import { isBlockFile, isSectionFile } from '../../utils';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import { GetTranslationsForURI } from '../../../translations';
import { isSectionOrBlockSchema } from './BlockTypeCompletionProvider';
import { schemaSettingsPropertyCompletionItems } from '../../schemaSettings';

/**
 * The SettingsPropertyCompletionProvider offers property completions for:
 * - `presets.[].settings.[]` objects inside `{% schema %}` tag in sections and blocks
 * - `default.settings` object inside `{% schema %}` tag in sections
 *
 * @example
 * {% schema %}
 * {
 *   "presets": [
 *     {
 *       "settings": [
 *         { "█" },
 *       ]
 *     },
 *   ],
 *   "default": {
 *     "settings": {
 *       "█"
 *     }
 *   }
 * }
 * {% endschema %}
 */
export class SettingsPropertyCompletionProvider implements JSONCompletionProvider {
  constructor(public getDefaultSchemaTranslations: GetTranslationsForURI) {}

  async completeProperty(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]> {
    const { doc } = context;

    if (doc.type !== SourceCodeType.LiquidHtml) return [];

    // section files can have schemas with `presets` and `default`
    // block files can have schemas with `presets` only
    if (
      !(isSectionFile(doc.uri) && (isPresetSettingsPath(path) || isDefaultSettingsPath(path))) &&
      !(isBlockFile(doc.uri) && isPresetSettingsPath(path))
    ) {
      return [];
    }

    const schema = await doc.getSchema();

    if (!schema || !isSectionOrBlockSchema(schema) || isError(schema.parsed)) {
      return [];
    }

    const parsedSchema = schema.parsed;

    if (!parsedSchema?.settings || !Array.isArray(parsedSchema.settings)) {
      return [];
    }

    const translations = await this.getDefaultSchemaTranslations(doc.textDocument.uri);

    return schemaSettingsPropertyCompletionItems(parsedSchema.settings, translations);
  }
}

function isPresetSettingsPath(path: JSONPath) {
  return path.length === 3 && path.at(0) === 'presets' && path.at(2) === 'settings';
}

function isDefaultSettingsPath(path: JSONPath) {
  return path.length === 2 && path.at(0) === 'default' && path.at(1) === 'settings';
}
