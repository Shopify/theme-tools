"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppBlockValidTags = exports.ForbiddenTag = void 0;
const types_1 = require("../../types");
var ForbiddenTag;
(function (ForbiddenTag) {
    ForbiddenTag["JavaScript"] = "javascript";
    ForbiddenTag["StyleSheet"] = "stylesheet";
    ForbiddenTag["Include"] = "include";
    ForbiddenTag["Layout"] = "layout";
    ForbiddenTag["Section"] = "section";
    ForbiddenTag["Sections"] = "sections";
})(ForbiddenTag || (exports.ForbiddenTag = ForbiddenTag = {}));
const isForbiddenTag = (value) => {
    return Object.values(ForbiddenTag).includes(value);
};
const buildErrorMessage = (tag) => `Theme app extension blocks cannot contain '${tag}' tags`;
exports.AppBlockValidTags = {
    meta: {
        code: 'AppBlockValidTags',
        name: 'App Block Valid Tags',
        docs: {
            description: 'Identifies forbidden Liquid tags in theme app extension app block and app embed block code.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/app-block-valid-tags',
            recommended: false,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [types_1.ConfigTarget.ThemeAppExtension],
    },
    create(context) {
        const handleForbiddenTags = async (node) => {
            if (isForbiddenTag(node.name)) {
                // When a forbidden tag is used to define a block section
                // with an end tag, highlight the whole section
                const endIndex = node.blockEndPosition ? node.blockEndPosition.end : node.position.end;
                const startIndex = node.blockStartPosition.start;
                const message = buildErrorMessage(node.name);
                return context.report({ message, startIndex, endIndex });
            }
        };
        return {
            LiquidRawTag: handleForbiddenTags,
            LiquidTag: handleForbiddenTags,
        };
    },
};
//# sourceMappingURL=index.js.map