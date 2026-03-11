import { JSONPath } from 'vscode-json-languageservice';
import { GetTranslationsForURI } from '../../../translations';
import { RequestContext } from '../../RequestContext';
import { JSONCompletionItem, JSONCompletionProvider } from '../JSONCompletionProvider';
export declare class SchemaTranslationsCompletionProvider implements JSONCompletionProvider {
    private getDefaultSchemaTranslations;
    constructor(getDefaultSchemaTranslations: GetTranslationsForURI);
    completeValue(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
}
