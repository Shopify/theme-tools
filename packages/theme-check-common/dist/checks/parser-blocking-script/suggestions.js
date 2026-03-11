"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scriptTagSuggestion = exports.liquidFilterSuggestion = void 0;
const utils_1 = require("../../utils");
const suggestionMessage = (attr) => `Use an HTML script tag with the ${attr} attribute instead`;
const liquidFilterSuggestion = (attr, node, parentNode, grandParentNode) => ({
    message: suggestionMessage(attr),
    fix(corrector) {
        var _a, _b;
        const expression = node.source.slice(parentNode.expression.position.start, (_b = (_a = (0, utils_1.last)(parentNode.filters, -1)) === null || _a === void 0 ? void 0 : _a.position.end) !== null && _b !== void 0 ? _b : node.position.start);
        const url = `{{ ${expression} }}`;
        corrector.replace(grandParentNode.position.start, grandParentNode.position.end, `<script src="${url}" ${attr}></script>`);
    },
});
exports.liquidFilterSuggestion = liquidFilterSuggestion;
const scriptTagSuggestion = (attr, node) => ({
    message: suggestionMessage(attr),
    fix(corrector) {
        corrector.insert(node.blockStartPosition.end - 1, ` ${attr}`);
    },
});
exports.scriptTagSuggestion = scriptTagSuggestion;
//# sourceMappingURL=suggestions.js.map