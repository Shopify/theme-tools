"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlElementNameWordPattern = void 0;
const nameCharStart = '[a-zA-Z]';
const nameChar = '[a-zA-Z0-9-]';
exports.htmlElementNameWordPattern = `${nameCharStart}${nameChar}*`;
//# sourceMappingURL=wordPattern.js.map