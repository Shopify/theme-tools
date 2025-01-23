import { parse as jsonParse } from 'jsonc-parser';
import { isError, SourceCodeType } from '@shopify/theme-check-common';
import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { RequestContext } from '../../RequestContext';
import { isBlockFile, isSectionFile } from '../../utils';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import { isSectionOrBlockSchema } from './BlockTypeCompletionProvider';
import { CompletionItemKind } from 'vscode-languageserver-protocol';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../../translations';

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
    if (context.doc.type !== SourceCodeType.LiquidHtml) return [];

    // section files can have schemas with `presets` and `default`
    // block files can have schemas with `presets` only
    if (
      !(
        isSectionFile(context.doc.uri) &&
        (isPresetSettingsPath(path) || isDefaultSettingsPath(path))
      ) &&
      !(isBlockFile(context.doc.uri) && isPresetSettingsPath(path))
    ) {
      return [];
    }

    const { doc } = context;
    const schema = await doc.getSchema();

    if (!schema || !isSectionOrBlockSchema(schema)) {
      return [];
    }

    let parsedSchema: any;

    /**
     * Since we are auto-completing JSON properties, we could be in a state where the schema is invalid.
     * E.g.
     * {
     *   "█"
     * }
     *
     * In that case, we manually parse the schema ourselves with a more fault-tolerant approach.
     */
    if (isError(schema.parsed)) {
      parsedSchema = jsonParse(schema.value);
    } else {
      parsedSchema = schema.parsed;
    }

    if (!parsedSchema?.settings || !Array.isArray(parsedSchema.settings)) {
      return [];
    }

    const translations = await this.getDefaultSchemaTranslations(doc.textDocument.uri);

    return parsedSchema.settings
      .filter((setting: any) => setting.id)
      .map((setting: any) => {
        let docValue = '';

        if (setting.label) {
          if (setting.label.startsWith('t:')) {
            const translation = translationValue(setting.label.substring(2), translations);
            if (translation) {
              docValue = renderTranslation(translation);
            }
          } else {
            docValue = setting.label;
          }
        }

        return {
          kind: CompletionItemKind.Property,
          label: `"${setting.id}"`,
          insertText: `"${setting.id}"`,
          documentation: {
            kind: 'markdown',
            value: docValue,
          },
        };
      });
  }
}

function isPresetSettingsPath(path: JSONPath) {
  return path.length === 3 && path.at(0) === 'presets' && path.at(2) === 'settings';
}

function isDefaultSettingsPath(path: JSONPath) {
  return path.length === 2 && path.at(0) === 'default' && path.at(1) === 'settings';
}
