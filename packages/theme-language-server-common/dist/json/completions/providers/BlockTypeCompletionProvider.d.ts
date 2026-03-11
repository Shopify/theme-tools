import { AppBlockSchema, SectionSchema, ThemeBlockSchema } from '@shopify/theme-check-common';
import { JSONPath } from 'vscode-json-languageservice';
import { JSONCompletionItem } from 'vscode-json-languageservice/lib/umd/jsonContributions';
import { RequestContext } from '../../RequestContext';
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
export declare class BlockTypeCompletionProvider implements JSONCompletionProvider {
    private getThemeBlockNames;
    constructor(getThemeBlockNames: GetThemeBlockNames);
    completeValue(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
}
export declare function createBlockNameCompletionItems(blockNames: string[]): {
    kind: 12;
    label: string;
    insertText: string;
}[];
export declare function isBlockDefinitionPath(path: JSONPath): boolean;
export declare function isPresetBlockPath(path: JSONPath): boolean;
export declare function isBlockTypePath(path: JSONPath): boolean;
export declare function hasLocalBlockDefinitions(schema: SectionSchema | ThemeBlockSchema): boolean;
export declare function isLocalBlockDefinition(schema: ThemeBlockSchema | SectionSchema, blockTypePath: JSONPath): boolean;
export declare function isSectionOrBlockSchema(schema: SectionSchema | ThemeBlockSchema | AppBlockSchema): schema is SectionSchema | ThemeBlockSchema;
