import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { GetTranslationsForURI } from '../../../translations';
import { LiquidRequestContext, RequestContext } from '../../RequestContext';
import { JSONHoverProvider } from '../JSONHoverProvider';
import { GetThemeBlockSchema } from '../../JSONContributions';
export declare class BlockSettingsHoverProvider implements JSONHoverProvider {
    private getDefaultSchemaTranslations;
    private getThemeBlockSchema;
    constructor(getDefaultSchemaTranslations: GetTranslationsForURI, getThemeBlockSchema: GetThemeBlockSchema);
    canHover(context: RequestContext, path: JSONPath): context is LiquidRequestContext;
    hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]>;
}
