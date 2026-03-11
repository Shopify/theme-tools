import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { GetTranslationsForURI } from '../../../translations';
import { LiquidRequestContext, RequestContext } from '../../RequestContext';
import { JSONHoverProvider } from '../JSONHoverProvider';
export declare class SettingsHoverProvider implements JSONHoverProvider {
    private getDefaultSchemaTranslations;
    constructor(getDefaultSchemaTranslations: GetTranslationsForURI);
    canHover(context: RequestContext, path: JSONPath): context is LiquidRequestContext;
    hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]>;
}
