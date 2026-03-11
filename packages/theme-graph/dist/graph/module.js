"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModule = getModule;
exports.getTemplateModule = getTemplateModule;
exports.getThemeBlockModule = getThemeBlockModule;
exports.getSectionModule = getSectionModule;
exports.getSectionGroupModule = getSectionGroupModule;
exports.getAssetModule = getAssetModule;
exports.getSnippetModule = getSnippetModule;
exports.getLayoutModule = getLayoutModule;
const theme_check_common_1 = require("@shopify/theme-check-common");
const types_1 = require("../types");
const utils_1 = require("../utils");
/**
 * We're using a ModuleCache to prevent race conditions with traverse.
 *
 * e.g. if we have two modules that depend on the same 'assets/foo.js' file and
 * that they somehow depend on it before it gets traversed (and thus added to the
 * graphs' modules record), we want to avoid creating two different module objects
 * that represent the same file.
 *
 * We're using a WeakMap<ThemeGraph> to cache modules so that if the theme graph
 * gets garbage collected, the module cache will also be garbage collected.
 *
 * This allows us to have a module cache without changing the API of the
 * ThemeGraph (no need for a `visited` property on modules, etc.)
 */
const ModuleCache = new WeakMap();
function getModule(themeGraph, uri) {
    const cache = getCache(themeGraph);
    if (cache.has(uri)) {
        return cache.get(uri);
    }
    const relativePath = theme_check_common_1.path.relative(uri, themeGraph.rootUri);
    switch (true) {
        case relativePath.startsWith('assets'): {
            return getAssetModule(themeGraph, theme_check_common_1.path.basename(uri));
        }
        case relativePath.startsWith('blocks'): {
            return getThemeBlockModule(themeGraph, theme_check_common_1.path.basename(uri, '.liquid'));
        }
        case relativePath.startsWith('layout'): {
            return getLayoutModule(themeGraph, theme_check_common_1.path.basename(uri, '.liquid'));
        }
        case relativePath.startsWith('sections'): {
            if (relativePath.endsWith('.json')) {
                return getSectionGroupModule(themeGraph, theme_check_common_1.path.basename(uri, '.json'));
            }
            return getSectionModule(themeGraph, theme_check_common_1.path.basename(uri, '.liquid'));
        }
        case relativePath.startsWith('snippets'): {
            return getSnippetModule(themeGraph, theme_check_common_1.path.basename(uri, '.liquid'));
        }
        case relativePath.startsWith('templates'): {
            return getTemplateModule(themeGraph, uri);
        }
    }
}
function getTemplateModule(themeGraph, uri) {
    const extension = (0, utils_1.extname)(uri);
    switch (extension) {
        case 'json': {
            return module(themeGraph, {
                type: "JSON" /* ModuleType.Json */,
                kind: "template" /* JsonModuleKind.Template */,
                dependencies: [],
                references: [],
                uri: uri,
            });
        }
        case 'liquid': {
            return module(themeGraph, {
                type: "Liquid" /* ModuleType.Liquid */,
                kind: "template" /* LiquidModuleKind.Template */,
                dependencies: [],
                references: [],
                uri: uri,
            });
        }
        default: {
            throw new Error(`Unknown template type for ${uri}`);
        }
    }
}
function getThemeBlockModule(themeGraph, blockType) {
    const uri = theme_check_common_1.path.join(themeGraph.rootUri, 'blocks', `${blockType}.liquid`);
    return module(themeGraph, {
        type: "Liquid" /* ModuleType.Liquid */,
        kind: "block" /* LiquidModuleKind.Block */,
        dependencies: [],
        references: [],
        uri,
    });
}
function getSectionModule(themeGraph, sectionType) {
    const uri = theme_check_common_1.path.join(themeGraph.rootUri, 'sections', `${sectionType}.liquid`);
    return module(themeGraph, {
        type: "Liquid" /* ModuleType.Liquid */,
        kind: "section" /* LiquidModuleKind.Section */,
        dependencies: [],
        references: [],
        uri,
    });
}
function getSectionGroupModule(themeGraph, sectionGroupType) {
    const uri = theme_check_common_1.path.join(themeGraph.rootUri, 'sections', `${sectionGroupType}.json`);
    return module(themeGraph, {
        type: "JSON" /* ModuleType.Json */,
        kind: "section-group" /* JsonModuleKind.SectionGroup */,
        dependencies: [],
        references: [],
        uri,
    });
}
function getAssetModule(themeGraph, asset) {
    const extension = (0, utils_1.extname)(asset);
    let type = undefined;
    if (types_1.SUPPORTED_ASSET_IMAGE_EXTENSIONS.includes(extension)) {
        type = "Image" /* ModuleType.Image */;
    }
    else if (extension === 'js') {
        type = "JavaScript" /* ModuleType.JavaScript */;
    }
    else if (extension === 'css') {
        type = "CSS" /* ModuleType.Css */;
    }
    else if (extension === 'svg') {
        type = "SVG" /* ModuleType.Svg */;
    }
    if (!type) {
        return undefined;
    }
    return module(themeGraph, {
        type,
        kind: 'unused',
        dependencies: [],
        references: [],
        uri: theme_check_common_1.path.join(themeGraph.rootUri, 'assets', asset),
    });
}
function getSnippetModule(themeGraph, snippet) {
    const uri = theme_check_common_1.path.join(themeGraph.rootUri, 'snippets', `${snippet}.liquid`);
    return module(themeGraph, {
        type: "Liquid" /* ModuleType.Liquid */,
        kind: "snippet" /* LiquidModuleKind.Snippet */,
        uri: uri,
        dependencies: [],
        references: [],
    });
}
function getLayoutModule(themeGraph, layoutName = 'theme') {
    if (layoutName === false)
        return undefined;
    if (layoutName === undefined)
        layoutName = 'theme';
    const uri = theme_check_common_1.path.join(themeGraph.rootUri, 'layout', `${layoutName}.liquid`);
    return module(themeGraph, {
        type: "Liquid" /* ModuleType.Liquid */,
        kind: "layout" /* LiquidModuleKind.Layout */,
        uri: uri,
        dependencies: [],
        references: [],
    });
}
function getCache(themeGraph) {
    if (!ModuleCache.has(themeGraph)) {
        ModuleCache.set(themeGraph, new Map());
    }
    return ModuleCache.get(themeGraph);
}
function module(themeGraph, mod) {
    const cache = getCache(themeGraph);
    if (!cache.has(mod.uri)) {
        cache.set(mod.uri, mod);
    }
    return cache.get(mod.uri);
}
//# sourceMappingURL=module.js.map