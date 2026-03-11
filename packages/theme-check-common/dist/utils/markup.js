"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContentForBlock = isContentForBlock;
function isContentForBlock(nodeMarkup) {
    if (typeof nodeMarkup === 'string') {
        return false;
    }
    return nodeMarkup.contentForType.value === 'block';
}
//# sourceMappingURL=markup.js.map