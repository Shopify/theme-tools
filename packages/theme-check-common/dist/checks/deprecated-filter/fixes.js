"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixHexToRgba = fixHexToRgba;
exports.suggestImgTagFix = suggestImgTagFix;
exports.suggestImgUrlFix = suggestImgUrlFix;
exports.suggestImageUrlFix = suggestImageUrlFix;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("../utils");
/**
 * Width and height values cannot exceed this maximum size.
 */
const MAX_SIZE = 5760;
const NAMED_SIZES = {
    pico: 16,
    icon: 32,
    thumb: 50,
    small: 100,
    compact: 160,
    medium: 240,
    large: 480,
    grande: 600,
    original: 1024,
};
function fixHexToRgba(node) {
    /**
     * Cannot fix invalid usage.
     *
     * The `hex_to_rgba` filter is only valid with zero or one argument (`alpha`).
     */
    if (node.args.length > 1)
        return;
    const { start, end } = getFilterSourceStartAndEnd(node);
    const alpha = getExpressionArgumentValue(node, 0);
    let fixedFilter;
    if (alpha) {
        fixedFilter = ` color_to_rgb | color_modify: 'alpha', ${alpha}`;
    }
    else {
        fixedFilter = ' color_to_rgb';
    }
    return (corrector) => corrector.replace(start, end, fixedFilter);
}
function suggestImgTagFix(node) {
    const message = "Replace 'img_tag' with 'image_tag'.";
    const alt = getExpressionArgumentValue(node, 0);
    const cssClass = getExpressionArgumentValue(node, 1);
    const sizeStr = getExpressionArgumentValue(node, 2);
    const { width, height } = getImageSize(sizeStr, { width: -1, height: -1 });
    const { start, end } = getFilterSourceStartAndEnd(node);
    const imageUrlParameters = ensureImageValue({ width, height });
    const imageTagParameters = {
        width,
        height,
        alt: strValue(alt),
        class: strValue(cssClass),
    };
    const imageUrlFilter = buildFilterString('image_url', imageUrlParameters);
    const imageTagFilter = buildFilterString('image_tag', imageTagParameters);
    return [
        {
            message,
            fix: (corrector) => {
                const insert = `${imageUrlFilter} |${imageTagFilter}`;
                corrector.replace(start, end, insert);
            },
        },
    ];
}
function suggestImgUrlFix(node) {
    const message = "Replace 'img_url' with 'image_url'.";
    const cropNode = getNamedArgumentNode(node, 'crop');
    const formatNode = getNamedArgumentNode(node, 'format');
    const scaleNode = getNamedArgumentNode(node, 'scale');
    const sizeStr = getExpressionArgumentValue(node, 0);
    const sizeNode = node.args.at(0);
    /**
     * Cannot fix when 'scale' or 'size' node are variable lookups.
     */
    if (isVariableLookup(scaleNode === null || scaleNode === void 0 ? void 0 : scaleNode.value) || isVariableLookup(sizeNode)) {
        return;
    }
    const { width, height } = ensureImageValue(scaleImage(node, getImageSize(sizeStr)));
    const { start, end } = getFilterSourceStartAndEnd(node);
    const parameters = { width, height };
    if (isStringLiteral(cropNode === null || cropNode === void 0 ? void 0 : cropNode.value)) {
        parameters['crop'] = strValue(cropNode.value.value);
    }
    if (isStringLiteral(formatNode === null || formatNode === void 0 ? void 0 : formatNode.value)) {
        parameters['format'] = strValue(formatNode.value.value);
    }
    if (isVariableLookup(formatNode === null || formatNode === void 0 ? void 0 : formatNode.value)) {
        parameters['format'] = formatNode.value.name;
    }
    return [
        {
            message,
            fix: (corrector) => {
                const insert = buildFilterString('image_url', parameters);
                corrector.replace(start, end, insert);
            },
        },
    ];
}
function suggestImageUrlFix(filter, node) {
    const message = `Replace '${filter}' with 'image_url'.`;
    const sizeStr = getExpressionArgumentValue(node, 0);
    const { width, height } = ensureImageValue(getImageSize(sizeStr));
    const { start, end } = getFilterSourceStartAndEnd(node);
    return [
        {
            message,
            fix: (corrector) => {
                const insert = buildFilterString('image_url', { width, height });
                corrector.replace(start, end, insert);
            },
        },
    ];
}
function getImageSize(size, imageSize = { width: 100, height: 100 }) {
    if (!size)
        return { ...imageSize };
    if (size in NAMED_SIZES) {
        const s = NAMED_SIZES[size];
        return { width: s, height: s };
    }
    const [width, height] = size.split('x').map((s) => parseInt(s));
    return ensureImageSizeLimit({ width, height });
}
function scaleImage(node, imageSize) {
    const scale = parseInt(getNamedArgumentValue(node, 'scale') || '0') || 1;
    return ensureImageSizeLimit({
        width: imageSize.width * scale,
        height: imageSize.height * scale,
    });
}
function ensureImageSizeLimit(imageSize) {
    return {
        width: Math.min(imageSize.width, MAX_SIZE),
        height: Math.min(imageSize.height, MAX_SIZE),
    };
}
function ensureImageValue(imageSize) {
    let { width, height } = imageSize;
    const isImageSizeUnset = (!height || height === -1) && (!width || width === -1);
    /**
     * If `image_url` is missing a width or height, we default to width=100, as
     * the documentation mention an error is returned if neither are specified
     * (interestingly, `image_url` doesn't actually fail during runtime tests).
     *
     * That default value is widely mentioned in the documentation and we've
     * confirmed that in runtime tests.
     */
    if (isImageSizeUnset) {
        width = 100;
    }
    return { width, height };
}
function getExpressionArgumentValue(node, index) {
    const arg = node.args.at(index);
    if (isNumberLiteral(arg) || isStringLiteral(arg)) {
        return arg.value;
    }
}
function getNamedArgumentValue(node, propertyName) {
    const argumentNode = getNamedArgumentNode(node, propertyName);
    const valueNode = argumentNode === null || argumentNode === void 0 ? void 0 : argumentNode.value;
    if (isNumberLiteral(valueNode) || isStringLiteral(valueNode)) {
        return valueNode.value;
    }
}
function getNamedArgumentNode(node, argName) {
    const args = node.args;
    return args.find((arg) => (0, utils_1.isNodeOfType)(liquid_html_parser_1.NodeTypes.NamedArgument, arg) && arg.name === argName);
}
function buildFilterString(filter, filterParameters) {
    const parameters = Object.entries(filterParameters)
        .filter(([_key, value]) => value && value !== -1)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    if (!parameters) {
        return ` ${filter}`;
    }
    return ` ${filter}: ${parameters}`;
}
function getFilterSourceStartAndEnd(node) {
    const position = node.position;
    const pipePosition = node.source.slice(position.start).indexOf('|');
    return {
        start: position.start + pipePosition + 1,
        end: position.end,
    };
}
function strValue(value) {
    return value ? `'${value}'` : null;
}
function isVariableLookup(exp) {
    return (0, utils_1.isNodeOfType)(liquid_html_parser_1.NodeTypes.VariableLookup, exp);
}
function isStringLiteral(exp) {
    return (0, utils_1.isNodeOfType)(liquid_html_parser_1.NodeTypes.String, exp);
}
function isNumberLiteral(exp) {
    return (0, utils_1.isNodeOfType)(liquid_html_parser_1.NodeTypes.Number, exp);
}
//# sourceMappingURL=fixes.js.map