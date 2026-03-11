"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin3 = exports.plugin2 = void 0;
const prettier_1 = require("prettier");
const parser_1 = require("./parser");
const printer_1 = require("./printer");
const languages = [
    {
        name: 'LiquidHTML',
        parsers: [parser_1.liquidHtmlLanguageName],
        extensions: ['.liquid'],
        vscodeLanguageIds: ['liquid', 'Liquid'],
    },
];
const options = {
    captureWhitespaceSensitivity: {
        type: 'choice',
        description: 'Specify the global whitespace sensitivity for the capture Liquid tag.',
        choices: [
            {
                value: 'strict',
                description: 'Whitespace inside {% capture var %} tags is considered significant.',
            },
            {
                value: 'ignore',
                description: 'Whitespace inside {% capture var %} tags is considered insignificant.',
            },
        ],
        category: 'LIQUID',
        default: 'strict',
        since: '1.5.0',
    },
    liquidSingleQuote: {
        type: 'boolean',
        category: 'LIQUID',
        default: true,
        description: 'Use single quotes instead of double quotes in Liquid tags and objects.',
        since: '0.2.0',
    },
    embeddedSingleQuote: {
        type: 'boolean',
        category: 'LIQUID',
        default: true,
        description: 'Use single quotes instead of double quotes in embedded languages (JavaScript, CSS, TypeScript inside <script>, <style> or Liquid equivalent).',
        since: '0.4.0',
    },
    singleLineLinkTags: {
        type: 'boolean',
        category: 'HTML',
        default: false,
        description: 'Always print link tags on a single line to remove clutter',
        since: '0.1.0',
    },
    indentSchema: {
        type: 'boolean',
        category: 'LIQUID',
        default: false,
        description: 'Indent the contents of the {% schema %} tag',
        since: '0.1.0',
    },
    liquidDocParamDash: {
        type: 'boolean',
        category: 'LIQUID',
        default: true,
        description: 'Append a dash (-) to separate descriptions in {% doc %} @param annotations',
        since: '1.6.4',
    },
};
const defaultOptions = {
    printWidth: 120,
};
exports.plugin2 = {
    languages,
    parsers: parser_1.parsers,
    printers: printer_1.printers2,
    options,
    defaultOptions,
};
exports.plugin3 = {
    languages,
    parsers: parser_1.parsers,
    printers: printer_1.printers3,
    options,
    defaultOptions,
};
const prettierMajor = prettier_1.version.split('.')[0];
exports.default = prettierMajor === '2' ? exports.plugin2 : exports.plugin3;
//# sourceMappingURL=plugin.js.map