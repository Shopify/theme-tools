import { parse as jsonParse } from 'jsonc-parser';
import { isError, SourceCodeType } from '@shopify/theme-check-common';
import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { RequestContext } from '../../RequestContext';
import { fileMatch } from '../../utils';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import { isSectionOrBlockSchema } from './BlockTypeCompletionProvider';
import { CompletionItemKind } from 'vscode-languageserver-protocol';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../../translations';

/**
 * The PresetsSettingsPropertyCompletionProvider offers property completions of the
 * `presets.[].settings.[]` objects inside section and theme block `{% schema %}` tags.
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
 *   ]
 * }
 * {% endschema %}
 */
export class PresetsSettingsPropertyCompletionProvider implements JSONCompletionProvider {
  private uriPatterns = [/^.*\/(sections|blocks)\/[^\/]*\.liquid$/];

  constructor(public getDefaultSchemaTranslations: GetTranslationsForURI) {}

  async completeProperty(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]> {
    if (
      !fileMatch(context.doc.uri, this.uriPatterns) ||
      context.doc.type !== SourceCodeType.LiquidHtml ||
      !isPresetSettingsPath(path)
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
  return path.at(0) === 'presets' && path.at(2) === 'settings';
}
