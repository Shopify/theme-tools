import { Section, Setting, Translations } from '@shopify/theme-check-common';
import { JSONCompletionItem } from './completions/JSONCompletionProvider';
export declare function schemaSettingsPropertyCompletionItems(parsedSettings: Partial<Setting.Any>[], translations: Translations): JSONCompletionItem[];
export declare function getSectionBlockByName(parsedSchema: any | undefined, blockName: string): Partial<Section.LocalBlock> | undefined;
