import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { JSONRequestContext, RequestContext } from '../../RequestContext';
import { JSONHoverProvider } from '../JSONHoverProvider';
export declare class TranslationPathHoverProvider implements JSONHoverProvider {
    private filePatterns;
    canHover(context: RequestContext, path: JSONPath): context is JSONRequestContext;
    hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]>;
}
export declare function contextualizedLabel(uri: string, str: (string | number)[], value: string): MarkedString;
