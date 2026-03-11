"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_LIQUID_DOC_TAG_HANDLES = void 0;
exports.formatLiquidDocParameter = formatLiquidDocParameter;
exports.formatLiquidDocTagHandle = formatLiquidDocTagHandle;
exports.getParameterCompletionTemplate = getParameterCompletionTemplate;
exports.formatLiquidDocContentMarkdown = formatLiquidDocContentMarkdown;
const theme_check_common_1 = require("@shopify/theme-check-common");
function formatLiquidDocParameter({ name, type, description, required }, heading = false) {
    const nameStr = required ? `\`${name}\`` : `\`${name}\` (Optional)`;
    const typeStr = type ? `: ${type}` : '';
    if (heading) {
        const descStr = description ? `\n\n${description}` : '';
        return `### ${nameStr}${typeStr}${descStr}`;
    }
    const descStr = description ? ` - ${description}` : '';
    return `- ${nameStr}${typeStr}${descStr}`;
}
function formatLiquidDocTagHandle(label, description, example) {
    return `### @${label}\n\n${description}\n\n` + `**Example**\n\n\`\`\`liquid\n${example}\n\`\`\``;
}
exports.SUPPORTED_LIQUID_DOC_TAG_HANDLES = {
    [theme_check_common_1.SupportedDocTagTypes.Param]: {
        description: 'Provides information about a parameter for the snippet.\n' +
            `- The type of parameter is optional and can be ${Object.values(theme_check_common_1.BasicParamTypes)
                .map((type) => `\`${type}\``)
                .join(', ')}\n` +
            ` or liquid object that isn't exclusively a global object in our [API Docs](https://shopify.dev/docs/api/liquid/objects)\n` +
            '- An optional parameter is denoted by square brackets around the parameter name\n' +
            '- The description is optional Markdown text',
        example: '{% doc %}\n' +
            "  @param {string} name - The person's name\n" +
            "  @param {number} [fav_num] - The person's favorite number\n" +
            "  @param {product} prod - The person's chosen product\n" +
            '{% enddoc %}\n',
        template: `param {$2} $1$0`,
    },
    [theme_check_common_1.SupportedDocTagTypes.Example]: {
        description: 'Provides an example on how to use the snippet.',
        example: '{% doc %}\n' + '  @example {% render "snippet-name", arg1: "value" %}\n' + '{% enddoc %}\n',
        template: `example $0`,
    },
    [theme_check_common_1.SupportedDocTagTypes.Description]: {
        description: 'Provides information on what the snippet does.',
        example: '{% doc %}\n' + '  @description This snippet renders a product image.\n' + '{% enddoc %}\n',
        template: `description $0`,
    },
};
function getParameterCompletionTemplate(name, type) {
    const paramDefaultValue = (0, theme_check_common_1.getDefaultValueForType)(type);
    const valueTemplate = paramDefaultValue === "''" ? `'$1'$0` : `\${1:${paramDefaultValue}}$0`;
    return `${name}: ${valueTemplate}`;
}
function formatLiquidDocContentMarkdown(name, docDefinition) {
    var _a, _b, _c;
    const liquidDoc = docDefinition === null || docDefinition === void 0 ? void 0 : docDefinition.liquidDoc;
    if (!liquidDoc) {
        return `### ${name}`;
    }
    const parts = [`### ${name}`];
    if (liquidDoc.description) {
        const description = liquidDoc.description.content;
        parts.push('', '**Description:**', '\n', description);
    }
    if ((_a = liquidDoc.parameters) === null || _a === void 0 ? void 0 : _a.length) {
        const parameters = liquidDoc.parameters
            .map((param) => formatLiquidDocParameter(param))
            .join('\n');
        parts.push('', '**Parameters:**', parameters);
    }
    if ((_b = liquidDoc.examples) === null || _b === void 0 ? void 0 : _b.length) {
        const examples = (_c = liquidDoc.examples) === null || _c === void 0 ? void 0 : _c.map(({ content }) => `\`\`\`liquid\n${content}\n\`\`\``).join('\n');
        parts.push('', '**Examples:**', examples);
    }
    return parts.join('\n');
}
//# sourceMappingURL=liquidDoc.js.map