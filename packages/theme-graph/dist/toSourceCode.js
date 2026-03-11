"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCssSourceCode = toCssSourceCode;
exports.toSvgSourceCode = toSvgSourceCode;
exports.toJsSourceCode = toJsSourceCode;
exports.parseJs = parseJs;
exports.toSourceCode = toSourceCode;
const theme_check_common_1 = require("@shopify/theme-check-common");
const acorn_1 = require("acorn");
const types_1 = require("./types");
const utils_1 = require("./utils");
async function toCssSourceCode(uri, source) {
    return {
        type: 'css',
        uri,
        source,
        ast: new Error('File parsing not implemented yet'), // Placeholder for CSS parsing
    };
}
async function toSvgSourceCode(uri, source) {
    return {
        type: 'svg',
        uri,
        source,
        ast: new Error('File parsing not implemented yet'), // Placeholder for SVG parsing
    };
}
async function toImageSourceCode(uri, source) {
    return {
        type: 'image',
        uri,
        source,
        ast: new Error('Image files are not parsed'),
    };
}
async function toJsSourceCode(uri, source) {
    return {
        type: 'javascript',
        uri,
        source,
        ast: parseJs(source),
    };
}
function parseJs(source) {
    try {
        return (0, acorn_1.parse)(source, {
            ecmaVersion: 'latest',
            sourceType: 'module',
        });
    }
    catch (error) {
        return (0, theme_check_common_1.asError)(error);
    }
}
async function toSourceCode(uri, source) {
    const extension = (0, utils_1.extname)(uri);
    if (extension === 'json' || extension === 'liquid') {
        return (0, theme_check_common_1.toSourceCode)(uri, source);
    }
    else if (extension === 'js') {
        return toJsSourceCode(uri, source);
    }
    else if (extension === 'css') {
        return toCssSourceCode(uri, source);
    }
    else if (extension === 'svg') {
        return toCssSourceCode(uri, source);
    }
    else if (types_1.SUPPORTED_ASSET_IMAGE_EXTENSIONS.includes(extension)) {
        return toImageSourceCode(uri, source);
    }
    else {
        throw new Error(`Unknown source code type for ${uri}`);
    }
}
//# sourceMappingURL=toSourceCode.js.map