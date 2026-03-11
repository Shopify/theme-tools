"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidJSON = void 0;
const types_1 = require("../../types");
exports.ValidJSON = {
    meta: {
        code: 'ValidJSON',
        aliases: ['ValidJson'],
        name: 'Enforce valid JSON',
        docs: {
            description: 'This check exists to prevent invalid JSON files in themes. Will check against schema if available.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/json-syntax-error',
        },
        type: types_1.SourceCodeType.JSON,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        if (!context.validateJSON)
            return {};
        const validateJSON = context.validateJSON;
        return {
            async onCodePathStart(file) {
                const problems = await validateJSON(file.uri, file.source);
                if (!problems)
                    return;
                for (const problem of problems) {
                    context.report(problem);
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map