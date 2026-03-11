import type { MarkupContent } from 'vscode-languageserver-protocol';
export interface HtmlData {
    version: number;
    tags: Tag[];
    globalAttributes: Attribute[];
    valueSets: ValueSet[];
}
export interface Tag {
    name: string;
    description: string | MarkupContent;
    attributes: Attribute[];
    references: Reference[];
    void?: boolean;
}
export interface Attribute {
    name: string;
    description: string | MarkupContent;
    references?: Reference[];
    valueSet?: ValueSetId;
}
export interface Reference {
    name: string;
    url: string;
}
type ValueSetId = string;
export interface ValueSet {
    name: ValueSetId;
    values: Value[];
}
export interface Value {
    name: string;
    description?: MarkupContent;
}
export declare const HtmlData: HtmlData;
export {};
