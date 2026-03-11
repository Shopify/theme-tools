"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRunChecks = makeRunChecks;
const theme_check_common_1 = require("@shopify/theme-check-common");
const offenseToDiagnostic_1 = require("./offenseToDiagnostic");
function makeRunChecks(documentManager, diagnosticsManager, { fs, loadConfig, themeDocset, jsonValidationSet, getMetafieldDefinitions, cssLanguageService, themeGraphManager, }) {
    return async function runChecks(triggerURIs) {
        // This function takes an array of triggerURIs so that we can correctly
        // recheck on file renames that came from out of bounds in a
        // workspaces.
        //
        // e.g. if a user renames
        //  theme1/snippets/a.liquid to
        //  theme1/snippets/b.liquid
        //
        // then we recheck theme1
        const fileExists = (0, theme_check_common_1.makeFileExists)(fs);
        const rootURIs = await Promise.all(triggerURIs.map((uri) => (0, theme_check_common_1.findRoot)(uri, fileExists)));
        const deduplicatedRootURIs = new Set(rootURIs.filter((x) => !!x));
        await Promise.all([...deduplicatedRootURIs].map(runChecksForRoot));
        return;
        async function runChecksForRoot(configFileRootUri) {
            const config = await loadConfig(configFileRootUri, fs);
            const theme = documentManager.theme(config.rootUri);
            const cssOffenses = cssLanguageService
                ? await Promise.all(theme.map((sourceCode) => getCSSDiagnostics(cssLanguageService, sourceCode))).then((offenses) => offenses.flat())
                : [];
            const themeOffenses = await (0, theme_check_common_1.check)(theme, config, {
                fs,
                themeDocset,
                jsonValidationSet,
                getMetafieldDefinitions,
                async getReferences(uri) {
                    if (!themeGraphManager)
                        return [];
                    return themeGraphManager.getReferences(uri);
                },
                // TODO should do something for app blocks?
                async getBlockSchema(name) {
                    // We won't preload here. If it's available, we'll give it. Otherwise expect nothing.
                    const uri = theme_check_common_1.path.join(config.rootUri, 'blocks', `${name}.liquid`);
                    const doc = documentManager.get(uri);
                    if ((doc === null || doc === void 0 ? void 0 : doc.type) !== theme_check_common_1.SourceCodeType.LiquidHtml)
                        return undefined;
                    const schema = await doc.getSchema();
                    return schema;
                },
                async getSectionSchema(name) {
                    // We won't preload here. If it's available, we'll give it. Otherwise expect nothing.
                    const uri = theme_check_common_1.path.join(config.rootUri, 'sections', `${name}.liquid`);
                    const doc = documentManager.get(uri);
                    if ((doc === null || doc === void 0 ? void 0 : doc.type) !== theme_check_common_1.SourceCodeType.LiquidHtml)
                        return undefined;
                    const schema = await doc.getSchema();
                    return schema;
                },
                async getDocDefinition(relativePath) {
                    const uri = theme_check_common_1.path.join(config.rootUri, relativePath);
                    const doc = documentManager.get(uri);
                    if ((doc === null || doc === void 0 ? void 0 : doc.type) !== theme_check_common_1.SourceCodeType.LiquidHtml)
                        return undefined;
                    return doc.getLiquidDoc();
                },
            });
            const offenses = [...themeOffenses, ...cssOffenses];
            // We iterate over the theme files (as opposed to offenses) because if
            // there were offenses before, we need to send an empty array to clear
            // them.
            for (const sourceCode of theme) {
                const sourceCodeOffenses = offenses.filter((offense) => offense.uri === sourceCode.uri);
                diagnosticsManager.set(sourceCode.uri, sourceCode.version, sourceCodeOffenses);
            }
        }
    };
}
async function getCSSDiagnostics(cssLanguageService, sourceCode) {
    if (sourceCode.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
        return [];
    }
    const diagnostics = await cssLanguageService.diagnostics({
        textDocument: { uri: sourceCode.uri },
    });
    return diagnostics
        .map((diagnostic) => ({
        check: 'css',
        message: diagnostic.message,
        end: {
            index: sourceCode.textDocument.offsetAt(diagnostic.range.end),
            line: diagnostic.range.end.line,
            character: diagnostic.range.end.character,
        },
        start: {
            index: sourceCode.textDocument.offsetAt(diagnostic.range.start),
            line: diagnostic.range.start.line,
            character: diagnostic.range.start.character,
        },
        severity: (0, offenseToDiagnostic_1.offenseSeverity)(diagnostic),
        uri: sourceCode.uri,
        type: theme_check_common_1.SourceCodeType.LiquidHtml,
    }))
        .filter((offense) => offense.severity !== theme_check_common_1.Severity.INFO);
}
//# sourceMappingURL=runChecks.js.map