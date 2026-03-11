"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doesFileExist = doesFileExist;
exports.doesFileExceedThreshold = doesFileExceedThreshold;
exports.getFileSize = getFileSize;
exports.hasRemoteAssetSizeExceededThreshold = hasRemoteAssetSizeExceededThreshold;
exports.hasLocalAssetSizeExceededThreshold = hasLocalAssetSizeExceededThreshold;
const cross_fetch_1 = require("cross-fetch");
async function doesFileExist(context, relativePath) {
    const uri = context.toUri(relativePath);
    return await context.fileExists(uri);
}
async function doesFileExceedThreshold(context, relativePath, thresholdInBytes) {
    const uri = context.toUri(relativePath);
    if (!context.fileSize)
        return [false, 0];
    const fileSize = await context.fileSize(uri);
    return [fileSize > thresholdInBytes, fileSize];
}
async function getFileSize(url) {
    try {
        const response = await (0, cross_fetch_1.fetch)(url, { method: 'HEAD' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fileSize = response.headers.get('Content-Length');
        if (fileSize === null)
            return 0;
        return parseFloat(fileSize);
    }
    catch (error) {
        return 0;
    }
}
async function hasRemoteAssetSizeExceededThreshold(url, thresholdInBytes) {
    const fileSize = await getFileSize(url);
    return fileSize > thresholdInBytes;
}
async function hasLocalAssetSizeExceededThreshold(context, relativePath, thresholdInBytes) {
    const fileExists = await doesFileExist(context, relativePath);
    if (!fileExists)
        return false;
    const [fileExceedsThreshold, _fileSize] = await doesFileExceedThreshold(context, relativePath, thresholdInBytes);
    return fileExceedsThreshold;
}
//# sourceMappingURL=file-utils.js.map