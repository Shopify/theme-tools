"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeThemeGraph = serializeThemeGraph;
function serializeThemeGraph(graph) {
    const nodes = Object.values(graph.modules).map((module) => ({
        uri: module.uri,
        type: module.type,
        kind: module.kind,
        ...('exists' in module ? { exists: module.exists } : {}),
    }));
    const edges = Object.values(graph.modules).flatMap((module) => module.dependencies);
    return {
        rootUri: graph.rootUri,
        nodes,
        edges,
    };
}
//# sourceMappingURL=serialize.js.map