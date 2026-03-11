"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiredLayoutThemeObject = void 0;
const types_1 = require("../../types");
const utils_1 = require("../utils");
exports.RequiredLayoutThemeObject = {
    meta: {
        code: 'RequiredLayoutThemeObject',
        name: 'Prevent missing required objects in theme.liquid',
        docs: {
            description: 'This check prevents missing {{ content_for_header }} and {{ content_for_layout }} objects in layout/theme.liquid.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/required-layout-theme-object',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [types_1.ConfigTarget.All, types_1.ConfigTarget.Recommended],
    },
    create(context) {
        if (context.toRelativePath(context.file.uri) !== 'layout/theme.liquid') {
            return {};
        }
        const requiredObjects = ['content_for_header', 'content_for_layout'];
        const foundObjects = new Set();
        let headTag;
        let bodyTag;
        function checkVariableUsage(node) {
            if (node.name && requiredObjects.includes(node.name)) {
                foundObjects.add(node.name);
            }
        }
        return {
            async VariableLookup(node) {
                checkVariableUsage(node);
            },
            async HtmlElement(node) {
                if ((0, utils_1.isHtmlTag)(node, 'head')) {
                    headTag = node;
                }
                else if ((0, utils_1.isHtmlTag)(node, 'body')) {
                    bodyTag = node;
                }
            },
            async onCodePathEnd() {
                var _a, _b;
                for (const requiredObject of requiredObjects) {
                    if (!foundObjects.has(requiredObject)) {
                        const message = `The required object '{{ ${requiredObject} }}' is missing in layout/theme.liquid`;
                        const insertionNode = requiredObject === 'content_for_header' ? headTag : bodyTag;
                        const fixInsertPosition = insertionNode === null || insertionNode === void 0 ? void 0 : insertionNode.blockEndPosition.start;
                        context.report({
                            message,
                            startIndex: (_a = insertionNode === null || insertionNode === void 0 ? void 0 : insertionNode.position.start) !== null && _a !== void 0 ? _a : 0,
                            endIndex: (_b = insertionNode === null || insertionNode === void 0 ? void 0 : insertionNode.position.end) !== null && _b !== void 0 ? _b : 0,
                            fix: fixInsertPosition !== undefined
                                ? (corrector) => corrector.insert(fixInsertPosition, `{{ ${requiredObject} }}`)
                                : undefined,
                        });
                    }
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map