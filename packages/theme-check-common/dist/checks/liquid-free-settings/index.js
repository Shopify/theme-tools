"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidFreeSettings = void 0;
const to_source_code_1 = require("../../to-source-code");
const types_1 = require("../../types");
const visitor_1 = require("../../visitor");
exports.LiquidFreeSettings = {
    meta: {
        code: 'LiquidFreeSettings',
        name: 'Check for liquid free settings values',
        docs: {
            description: 'Ensures settings values are liquid free.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/liquid-free-settings',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidRawTag(node) {
                if (node.name !== 'schema' || node.body.kind !== 'json') {
                    return;
                }
                const jsonString = node.source.slice(node.blockStartPosition.end, node.blockEndPosition.start);
                const jsonFile = (0, to_source_code_1.toJSONAST)(jsonString);
                if (jsonFile instanceof Error)
                    return;
                (0, visitor_1.visit)(jsonFile, {
                    Property(schemaNode, ancestors) {
                        if (!isInArrayWithParentKey(ancestors, 'settings') ||
                            !isLiteralNode(schemaNode.value) ||
                            isLiquidType(ancestors)) {
                            return;
                        }
                        const { value, loc } = schemaNode.value;
                        const propertyValue = schemaNode.key.value;
                        if (typeof value === 'string' &&
                            propertyValue !== 'visible_if' &&
                            value.includes('{%') &&
                            value.includes('%}')) {
                            context.report({
                                message: 'Settings values cannot contain liquid logic.',
                                startIndex: node.blockStartPosition.end + loc.start.offset,
                                endIndex: node.blockStartPosition.end + loc.end.offset,
                            });
                        }
                    },
                });
            },
        };
    },
};
function isLiteralNode(node) {
    return node.type === 'Literal';
}
function isLiquidType(ancestors) {
    const parentJsonNode = ancestors.at(-1);
    if (!parentJsonNode || parentJsonNode.type !== 'Object') {
        return false;
    }
    return parentJsonNode.children.some(({ key, value }) => {
        if (key.value !== 'type' || !isLiteralNode(value)) {
            return false;
        }
        return value.value === 'liquid';
    });
}
function isInArrayWithParentKey(ancestors, parentKey) {
    return ancestors.some((ancestor, index) => {
        var _a;
        const parent = ancestors[index - 1];
        return ((ancestor.type === 'Array' || ancestor.type === 'Object') &&
            (parent === null || parent === void 0 ? void 0 : parent.type) === 'Property' &&
            ((_a = parent.key) === null || _a === void 0 ? void 0 : _a.value) === parentKey);
    });
}
//# sourceMappingURL=index.js.map