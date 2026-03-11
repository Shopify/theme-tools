"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosition = getPosition;
exports.getOffset = getOffset;
const line_column_1 = __importDefault(require("line-column"));
function getPosition(source, index) {
    const lineCol = (0, line_column_1.default)(source, { origin: 0 }).fromIndex(Math.min(index, source.length - 1));
    return {
        index,
        line: lineCol ? lineCol.line : -1,
        character: lineCol ? lineCol.col : -1,
    };
}
function getOffset(source, line, column) {
    return (0, line_column_1.default)(source, { origin: 1 }).toIndex(line, column);
}
//# sourceMappingURL=position.js.map