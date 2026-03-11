"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildThemeGraph = buildThemeGraph;
const theme_check_common_1 = require("@shopify/theme-check-common");
const augment_1 = require("./augment");
const module_1 = require("./module");
const traverse_1 = require("./traverse");
async function buildThemeGraph(rootUri, ideps, entryPoints) {
    const deps = (0, augment_1.augmentDependencies)(rootUri, ideps);
    entryPoints =
        entryPoints !== null && entryPoints !== void 0 ? entryPoints : (await (0, theme_check_common_1.recursiveReadDirectory)(deps.fs, rootUri, ([uri]) => {
            // Templates are entry points in the theme graph.
            const isTemplateFile = uri.startsWith(theme_check_common_1.path.join(rootUri, 'templates'));
            // Since any section file can be rendered directly by the Section Rendering API,
            // we consider all section files as entry points.
            const isSectionFile = uri.startsWith(theme_check_common_1.path.join(rootUri, 'sections')) && uri.endsWith('.liquid');
            return isTemplateFile || isSectionFile;
        }));
    const graph = {
        entryPoints: [],
        modules: {},
        rootUri,
    };
    graph.entryPoints = entryPoints
        .map((uri) => (0, module_1.getModule)(graph, uri))
        .filter((x) => x !== undefined);
    await Promise.all(graph.entryPoints.map((entry) => (0, traverse_1.traverseModule)(entry, graph, deps)));
    return graph;
}
//# sourceMappingURL=build.js.map