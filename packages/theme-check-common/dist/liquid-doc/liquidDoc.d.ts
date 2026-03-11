import { UriString } from '../types';
import { LiquidHtmlNode } from '../types';
export type GetDocDefinitionForURI = (uri: UriString, category: 'blocks' | 'snippets', name: string) => Promise<DocDefinition | undefined>;
export type DocDefinition = {
    uri: UriString;
    liquidDoc?: DocContent;
};
type DocContent = {
    parameters?: LiquidDocParameter[];
    examples?: LiquidDocExample[];
    description?: LiquidDocDescription;
};
interface LiquidDocNode {
    nodeType: 'param' | 'example' | 'description';
}
export interface LiquidDocParameter extends LiquidDocNode {
    nodeType: 'param';
    name: string;
    description: string | null;
    type: string | null;
    required: boolean;
}
export interface LiquidDocExample extends LiquidDocNode {
    content: string;
    nodeType: 'example';
}
export interface LiquidDocDescription extends LiquidDocNode {
    content: string;
    nodeType: 'description';
}
export declare function hasLiquidDoc(snippet: LiquidHtmlNode): boolean;
export declare function extractDocDefinition(uri: UriString, ast: LiquidHtmlNode): DocDefinition;
export {};
