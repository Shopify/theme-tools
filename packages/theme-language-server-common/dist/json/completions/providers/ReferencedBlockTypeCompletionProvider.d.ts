import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { RequestContext } from '../../RequestContext';
import { JSONCompletionProvider } from '../JSONCompletionProvider';
import { GetThemeBlockNames, GetThemeBlockSchema } from '../../JSONContributions';
/**
 * The ReferencedBlockTypeCompletionProvider offers value completions of the
 * `presets.[](recursive .blocks.[]).type` value and `default.blocks.[].type` value inside
 * section and theme block `{% schema %}` tags.
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
 *   ],
 *   "default": {
 *     "blocks": [
 *       { "type": "█" },
 *     ]
 *   }
 * }
 * {% endschema %}
 */
export declare class ReferencedBlockTypeCompletionProvider implements JSONCompletionProvider {
    private getThemeBlockNames;
    private getThemeBlockSchema;
    constructor(getThemeBlockNames: GetThemeBlockNames, getThemeBlockSchema: GetThemeBlockSchema);
    completeValue(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
}
