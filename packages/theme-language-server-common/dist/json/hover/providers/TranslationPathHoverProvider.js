"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationPathHoverProvider = void 0;
exports.contextualizedLabel = contextualizedLabel;
const theme_check_common_1 = require("@shopify/theme-check-common");
const translations_1 = require("../../../translations");
const RequestContext_1 = require("../../RequestContext");
const utils_1 = require("../../utils");
class TranslationPathHoverProvider {
    constructor() {
        this.filePatterns = [/^.*\/locales\/[^\/]*\.json$/];
    }
    canHover(context, path) {
        return ((0, utils_1.fileMatch)(context.doc.uri, this.filePatterns) &&
            path.length > 0 &&
            (0, RequestContext_1.isJSONRequestContext)(context));
    }
    async hover(context, path) {
        // Redundant use for type assertion
        if (!this.canHover(context, path))
            return [];
        const { doc } = context;
        const ast = doc.ast;
        const node = (0, theme_check_common_1.nodeAtPath)(ast, path);
        switch (true) {
            // Because the JSON language service doesn't support composition of hover info,
            // We have to hardcode the docs for the translation file schema here.
            case ['zero', 'one', 'two', 'few', 'many', 'other'].includes(path.at(-1)): {
                if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
                    return [`Pluralized translations should have a string value`];
                }
                return [contextualizedLabel(doc.uri, path.slice(0, -1), node.value)];
            }
            case path.at(-1).toString().endsWith('_html'): {
                if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
                    return [`Translations ending in '_html' should have a string value`];
                }
                return [
                    contextualizedLabel(doc.uri, path, node.value),
                    `The '_html' suffix prevents the HTML content from being escaped.`,
                ];
            }
            default: {
                if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
                    return [`Translation group: ${path.join('.')}`];
                }
                return [contextualizedLabel(doc.uri, path, node.value)];
            }
        }
    }
}
exports.TranslationPathHoverProvider = TranslationPathHoverProvider;
function contextualizedLabel(uri, str, value) {
    if (uri.includes('.schema')) {
        return marked(`"t:${str.join('.')}"`, 'json');
    }
    else {
        const params = (0, translations_1.extractParams)(value);
        return marked(`{{ '${str.join('.')}' | t${(0, translations_1.paramsString)(params)} }}`, 'liquid');
    }
}
function marked(value, language = 'liquid') {
    return { language, value };
}
//# sourceMappingURL=TranslationPathHoverProvider.js.map