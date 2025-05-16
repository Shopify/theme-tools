import { CompletionItemKind, MarkupKind } from 'vscode-json-languageservice';
import { renderTranslation, translationValue } from '../translations';
import { Section, Setting, Translations } from '@shopify/theme-check-common';
import { JSONCompletionItem } from './completions/JSONCompletionProvider';

export function schemaSettingsPropertyCompletionItems(
  parsedSettings: Partial<Setting.Any>[],
  translations: Translations,
): JSONCompletionItem[] {
  return parsedSettings
    .filter((setting) => setting.id)
    .map((setting) => {
      let docValue = '';

      if (setting.label) {
        if (setting.label.startsWith('t:')) {
          const translation = translationValue(setting.label.substring(2), translations);

          if (translation) {
            docValue = renderTranslation(translation);
          }
        } else {
          docValue = setting.label;
        }
      }

      const completionText = setting.id ? `"${setting.id}"` : '';

      return {
        kind: CompletionItemKind.Property,
        label: completionText,
        insertText: completionText,
        documentation: {
          kind: MarkupKind.Markdown,
          value: docValue,
        },
      };
    });
}

/*
 * JSONCompletionProviders have to be more fault tolerant since there can be errors
 * while typing the schema. This is why parsedSchemas (untyped) are used instead of
 * validSchemas (typed).
 */
export function getSectionBlockByName(
  parsedSchema: any = {},
  blockName: string,
): Partial<Section.LocalBlock> | undefined {
  return parsedSchema.blocks
    ?.filter((block: any) => 'name' in block)
    ?.find((block: any) => block.type === blockName);
}
