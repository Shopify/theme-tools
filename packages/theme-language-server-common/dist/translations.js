"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluralizedTranslationKeys = void 0;
exports.renderKey = renderKey;
exports.renderTranslation = renderTranslation;
exports.translationValue = translationValue;
exports.isPluralizedTranslation = isPluralizedTranslation;
exports.toOptions = toOptions;
exports.translationOptions = translationOptions;
exports.extractParams = extractParams;
exports.paramsString = paramsString;
exports.PluralizedTranslationKeys = ['one', 'few', 'many', 'two', 'zero', 'other'];
function renderKey(translation, key) {
    if (translation[key]) {
        return `\`${key}:\` ${translation[key]}`;
    }
}
function renderTranslation(translation) {
    if (typeof translation === 'string')
        return translation;
    return [
        renderKey(translation, 'zero'),
        renderKey(translation, 'one'),
        renderKey(translation, 'two'),
        renderKey(translation, 'few'),
        renderKey(translation, 'many'),
        renderKey(translation, 'other'),
    ]
        .filter(Boolean)
        .join('\n\n---\n\n');
}
function translationValue(path, translations) {
    const parts = path.split('.');
    let current = translations;
    for (const key of parts) {
        if (!current || typeof current === 'string') {
            return undefined;
        }
        current = current[key];
    }
    return current;
}
function isPluralizedTranslation(translations) {
    return Object.keys(translations).every((key) => exports.PluralizedTranslationKeys.includes(key));
}
function toOptions(prefix, translations) {
    return Object.entries(translations).flatMap(([path, translation]) => {
        if (typeof translation === 'string' || isPluralizedTranslation(translation)) {
            return [{ path: prefix.concat(path), translation }];
        }
        else {
            return toOptions(prefix.concat(path), translation);
        }
    });
}
function translationOptions(translations) {
    return toOptions([], translations);
}
function extractParams(value) {
    const regex = /\{\{([^}]+?)\}\}/g;
    const results = [];
    let current;
    while ((current = regex.exec(value)) !== null) {
        results.push(current[1].trim());
    }
    return results;
}
function paramsString(params) {
    if (params.length === 0)
        return '';
    return `: ` + params.map((param) => `${param}: ${param}`).join(', ');
}
//# sourceMappingURL=translations.js.map