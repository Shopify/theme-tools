import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { RequestContext } from '../../RequestContext';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import { GetTranslationsForURI } from '../../../translations';
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
export declare class SettingsPropertyCompletionProvider implements JSONCompletionProvider {
    getDefaultSchemaTranslations: GetTranslationsForURI;
    constructor(getDefaultSchemaTranslations: GetTranslationsForURI);
    completeProperty(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
}
