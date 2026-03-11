"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidHTMLTranslation = void 0;
const types_1 = require("../../types");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
exports.ValidHTMLTranslation = {
    meta: {
        code: 'ValidHTMLTranslation',
        name: 'Valid HTML Translation',
        docs: {
            description: 'This check exists to prevent invalid HTML inside translations.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-html-translation',
            recommended: true,
        },
        type: types_1.SourceCodeType.JSON,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        // We ignore non-`locales/` json files.
        const relativePath = context.toRelativePath(context.file.uri);
        if (!relativePath.startsWith('locales/'))
            return {};
        return {
            async Literal(node) {
                const htmlRegex = /<[^>]+>/;
                if (typeof node.value !== 'string' || !htmlRegex.test(node.value))
                    return;
                try {
                    (0, liquid_html_parser_1.toLiquidHtmlAST)(node.value);
                }
                catch (error) {
                    const loc = node.loc;
                    const problem = {
                        message: `${error}.`,
                        startIndex: loc.start.offset,
                        endIndex: loc.end.offset,
                    };
                    context.report(problem);
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map