"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = exports.URI = void 0;
exports.relative = relative;
exports.join = join;
exports.resolve = resolve;
exports.normalize = normalize;
exports.dirname = dirname;
exports.basename = basename;
exports.fsPath = fsPath;
const vscode_uri_1 = require("vscode-uri");
Object.defineProperty(exports, "URI", { enumerable: true, get: function () { return vscode_uri_1.URI; } });
Object.defineProperty(exports, "Utils", { enumerable: true, get: function () { return vscode_uri_1.Utils; } });
function relative(uri, rootUri) {
    return normalize(uri)
        .replace(rootUri, '')
        .replace(/\\\\/g, '/') // We expect forward slash paths (windows path get normalized)
        .replace(/^\/+/, '');
}
function join(rootUri, ...paths) {
    return normalize(vscode_uri_1.Utils.joinPath(asUri(rootUri), ...paths));
}
function resolve(uri, path) {
    return normalize(vscode_uri_1.Utils.resolvePath(asUri(uri), path));
}
function normalize(uri) {
    const normalized = asUri(uri).toString(true);
    // On Windows machines, paths use backslash ('\') as separator
    // This causes issues since backslashes in glob patterns are treated as escape characters
    // and in various URI contexts, forward slashes are expected
    // We replace all backslashes with forward slashes for cross-platform consistency
    return normalized.replace(/\\/g, '/');
}
function dirname(uri) {
    return normalize(vscode_uri_1.Utils.dirname(asUri(uri)));
}
function basename(uri, ext) {
    const base = vscode_uri_1.Utils.basename(asUri(uri));
    return ext ? base.replace(new RegExp(`${ext.replace(/\./g, '\\.')}$`), '') : base;
}
function fsPath(uri) {
    return asUri(uri).fsPath;
}
function asUri(uri) {
    return vscode_uri_1.URI.isUri(uri) ? uri : vscode_uri_1.URI.parse(uri);
}
//# sourceMappingURL=path.js.map