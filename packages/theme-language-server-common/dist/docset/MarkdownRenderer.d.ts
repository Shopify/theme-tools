import { DocsetEntry, FilterEntry, TagEntry } from '@shopify/theme-check-common';
import { ArrayType, PseudoType } from '../TypeSystem';
import { Attribute, Tag, Value } from './HtmlDocset';
export type HtmlEntry = Tag | Attribute | Value;
export type DocsetEntryType = 'filter' | 'tag' | 'object';
export declare function render(entry: DocsetEntry | FilterEntry | TagEntry, returnType?: PseudoType | ArrayType, docsetEntryType?: DocsetEntryType): string;
export declare function renderHtmlEntry(entry: HtmlEntry, parentEntry?: HtmlEntry): string;
