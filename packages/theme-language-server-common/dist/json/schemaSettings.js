"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaSettingsPropertyCompletionItems = schemaSettingsPropertyCompletionItems;
exports.getSectionBlockByName = getSectionBlockByName;
const vscode_json_languageservice_1 = require("vscode-json-languageservice");
const translations_1 = require("../translations");
function schemaSettingsPropertyCompletionItems(parsedSettings, translations) {
    return parsedSettings
        .filter((setting) => setting.id)
        .map((setting) => {
        let docValue = '';
        if (setting.label) {
            if (setting.label.startsWith('t:')) {
                const translation = (0, translations_1.translationValue)(setting.label.substring(2), translations);
                if (translation) {
                    docValue = (0, translations_1.renderTranslation)(translation);
                }
            }
            else {
                docValue = setting.label;
            }
        }
        const completionText = setting.id ? `"${setting.id}"` : '';
        return {
            kind: vscode_json_languageservice_1.CompletionItemKind.Property,
            label: completionText,
            insertText: completionText,
            documentation: {
                kind: vscode_json_languageservice_1.MarkupKind.Markdown,
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
function getSectionBlockByName(parsedSchema = {}, blockName) {
    var _a, _b;
    return (_b = (_a = parsedSchema.blocks) === null || _a === void 0 ? void 0 : _a.filter((block) => 'name' in block)) === null || _b === void 0 ? void 0 : _b.find((block) => block.type === blockName);
}
//# sourceMappingURL=schemaSettings.js.map