import { CompletionItemKind, MarkupKind } from 'vscode-json-languageservice';
import { renderTranslation, translationValue } from '../../../../translations';
import { Translations } from '@shopify/theme-check-common';

export function schemaSettingsPropertyCompletionItems(
  parsedSchema: any,
  translations: Translations,
) {
  return parsedSchema.settings
    .filter((setting: any) => setting.id)
    .map((setting: any) => {
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
