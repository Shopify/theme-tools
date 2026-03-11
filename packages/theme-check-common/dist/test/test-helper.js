"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringCorrector = exports.JSONCorrector = void 0;
exports.getTheme = getTheme;
exports.check = check;
exports.runLiquidCheck = runLiquidCheck;
exports.runJSONCheck = runJSONCheck;
exports.autofix = autofix;
exports.applyFix = applyFix;
exports.applySuggestions = applySuggestions;
exports.highlightedOffenses = highlightedOffenses;
exports.prettyJSON = prettyJSON;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const index_1 = require("../index");
Object.defineProperty(exports, "JSONCorrector", { enumerable: true, get: function () { return index_1.JSONCorrector; } });
Object.defineProperty(exports, "StringCorrector", { enumerable: true, get: function () { return index_1.StringCorrector; } });
const path = __importStar(require("../path"));
const MockFileSystem_1 = require("./MockFileSystem");
const rootUri = path.normalize('file:/');
function getTheme(themeDesc) {
    return Object.entries(themeDesc)
        .map(([relativePath, source]) => (0, index_1.toSourceCode)(toUri(relativePath), source))
        .filter((x) => x !== undefined);
}
async function check(themeDesc, checks = index_1.recommended, mockDependencies = {}, checkSettings = {}) {
    const theme = getTheme(themeDesc);
    const config = {
        context: 'theme',
        settings: { ...checkSettings },
        checks,
        rootUri,
        onError: (err) => {
            throw err;
        },
    };
    const sections = new Map(theme
        .filter((source) => (0, index_1.isSection)(source.uri))
        .map((source) => [path.basename(source.uri, '.liquid'), source]));
    const blocks = new Map(theme
        .filter((source) => (0, index_1.isBlock)(source.uri))
        .map((source) => [path.basename(source.uri, '.liquid'), source]));
    /**
     * Schemas are assumed to be valid in tests, hijack
     * getBlockSchema/getSectionSchema with overrides when you want to test
     * something otherwise
     */
    const isValidSchema = async () => true;
    const defaultMockDependencies = {
        fs: new MockFileSystem_1.MockFileSystem({ '.theme-check.yml': '', ...themeDesc }),
        async getBlockSchema(name) {
            const block = blocks.get(name);
            if (!block)
                return undefined;
            return (0, index_1.toSchema)(config.context, block.uri, block, isValidSchema);
        },
        async getSectionSchema(name) {
            const section = sections.get(name);
            if (!section)
                return undefined;
            return (0, index_1.toSchema)(config.context, section.uri, section, isValidSchema);
        },
        async getDocDefinition(relativePath) {
            const file = theme.find((file) => file.uri.endsWith(relativePath));
            if (!file || !(0, liquid_html_parser_1.isLiquidHtmlNode)(file.ast)) {
                return undefined;
            }
            return (0, index_1.extractDocDefinition)(file.uri, file.ast);
        },
        themeDocset: {
            async filters() {
                return [
                    { name: 'item_count_for_variant' },
                    { name: 'link_to_type' },
                    { name: 'link_to_vendor' },
                    { name: 'append' },
                    { name: 'upcase' },
                    { name: 'downcase' },
                    { name: 'color_to_rgb' },
                    {
                        name: 'hex_to_rgba',
                        deprecated: true,
                        deprecation_reason: '`hex_to_rgba` has been replaced by [`color_to_rgb`](/do...',
                    },
                    {
                        name: 'currency_selector',
                        deprecated: true,
                        deprecation_reason: 'Deprecated without a direct replacement because the [cur...',
                    },
                    {
                        name: 'article_img_url',
                        deprecated: true,
                        deprecation_reason: '`article_img_url` has been replaced by [`image_url`](/d...',
                    },
                    {
                        name: 'collection_img_url',
                        deprecated: true,
                        deprecation_reason: '`collection_img_url` has been replaced by [`image_url`](...',
                    },
                    {
                        name: 'img_tag',
                        deprecated: true,
                        deprecation_reason: '`img_tag` has been replaced by [`image_tag`](/docs/api/...',
                    },
                    {
                        name: 'img_url',
                        deprecated: true,
                        deprecation_reason: '`img_url` has been replaced by [`image_url`](/docs/api/...',
                    },
                    {
                        name: 'product_img_url',
                        deprecated: true,
                        deprecation_reason: '`product_img_url` has been replaced by [`image_url`](/d...',
                    },
                ];
            },
            async objects() {
                return [
                    {
                        name: 'collections',
                    },
                    {
                        name: 'product',
                        access: {
                            global: false,
                            parents: [],
                            template: ['product'],
                        },
                    },
                    {
                        name: 'image',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                    {
                        name: 'section',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                    {
                        name: 'block',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                    {
                        name: 'app',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                    {
                        name: 'predictive_search',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                    {
                        name: 'recommendations',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                    {
                        name: 'comment',
                        access: {
                            global: false,
                            parents: [],
                            template: [],
                        },
                    },
                ];
            },
            async liquidDrops() {
                return this.objects();
            },
            async tags() {
                return [];
            },
            async systemTranslations() {
                return { 'shopify.sentence.words_connector': ', ' };
            },
        },
    };
    return (0, index_1.check)(theme, config, { ...defaultMockDependencies, ...mockDependencies });
}
async function runLiquidCheck(checkDef, sourceCode, fileName = 'file.liquid', mockDependencies = {}, existingThemeFiles) {
    const offenses = await check({ ...existingThemeFiles, [fileName]: sourceCode }, [checkDef], mockDependencies);
    return offenses.filter((offense) => offense.uri === path.join(rootUri, fileName));
}
async function runJSONCheck(checkDef, sourceCode, fileName = 'file.json', mockDependencies = {}) {
    const offenses = await check({ [fileName]: sourceCode }, [checkDef], mockDependencies);
    return offenses.filter((offense) => offense.uri === path.join(rootUri, fileName));
}
async function autofix(themeDesc, offenses) {
    const theme = getTheme(themeDesc);
    const fixed = { ...themeDesc };
    const stringApplicator = async (sourceCode, fixes) => {
        fixed[asRelative(sourceCode.uri)] = (0, index_1.applyFixToString)(sourceCode.source, fixes);
    };
    await (0, index_1.autofix)(theme, offenses, stringApplicator);
    return fixed;
}
function applyFix(themeDescOrSource, offense) {
    var _a;
    const source = typeof themeDescOrSource === 'string'
        ? themeDescOrSource
        : themeDescOrSource[asRelative(offense.uri)];
    const corrector = (0, index_1.createCorrector)(offense.type, source);
    (_a = offense.fix) === null || _a === void 0 ? void 0 : _a.call(offense, corrector);
    return (0, index_1.applyFixToString)(source, corrector.fix);
}
function applySuggestions(themeDescOrSource, offense) {
    var _a;
    const source = typeof themeDescOrSource === 'string'
        ? themeDescOrSource
        : themeDescOrSource[asRelative(offense.uri)];
    return (_a = offense.suggest) === null || _a === void 0 ? void 0 : _a.map((suggestion) => {
        const corrector = (0, index_1.createCorrector)(offense.type, source);
        suggestion.fix(corrector);
        return (0, index_1.applyFixToString)(source, corrector.fix);
    });
}
function highlightedOffenses(themeOrSource, offenses) {
    const theme = typeof themeOrSource === 'string' ? { 'file.liquid': themeOrSource } : themeOrSource;
    return offenses.map((offense) => {
        const relativePath = path.relative(offense.uri, rootUri);
        const source = theme[relativePath];
        const { start: { index: startIndex }, end: { index: endIndex }, } = offense;
        return source.slice(startIndex, endIndex);
    });
}
function toUri(relativePath) {
    return path.join(rootUri, relativePath);
}
function asRelative(uri) {
    return path.relative(path.normalize(uri), rootUri);
}
function prettyJSON(obj) {
    return JSON.stringify(obj, null, 2);
}
//# sourceMappingURL=test-helper.js.map