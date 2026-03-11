import { DocsetEntry } from '@shopify/theme-check-common';
import { CompletionItem } from 'vscode-languageserver';
import { DocsetEntryType } from '../../../docset';
import { ArrayType, PseudoType } from '../../../TypeSystem';
export declare function createCompletionItem(entry: DocsetEntry & {
    deprioritized?: boolean;
}, extraProperties?: Partial<CompletionItem>, docsetEntryType?: DocsetEntryType, entryType?: PseudoType | ArrayType): CompletionItem;
