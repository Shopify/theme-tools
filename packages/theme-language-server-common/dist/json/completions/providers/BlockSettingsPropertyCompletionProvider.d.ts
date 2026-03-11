import { JSONPath } from 'vscode-json-languageservice';
import { GetThemeBlockSchema } from '../../JSONContributions';
import { RequestContext } from '../../RequestContext';
import { JSONCompletionItem, JSONCompletionProvider } from '../JSONCompletionProvider';
import { GetTranslationsForURI } from '../../../translations';
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
export declare class BlockSettingsPropertyCompletionProvider implements JSONCompletionProvider {
    private getDefaultSchemaTranslations;
    private getThemeBlockSchema;
    constructor(getDefaultSchemaTranslations: GetTranslationsForURI, getThemeBlockSchema: GetThemeBlockSchema);
    completeProperty(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
}
