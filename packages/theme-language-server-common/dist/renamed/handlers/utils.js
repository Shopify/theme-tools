"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidTemplate = isValidTemplate;
exports.isValidSectionGroup = isValidSectionGroup;
// this is very very optimistic...
function isValidTemplate(parsed) {
    return (typeof parsed === 'object' &&
        parsed !== null &&
        'sections' in parsed &&
        'order' in parsed &&
        Array.isArray(parsed.order));
}
function isValidSectionGroup(parsed) {
    return (typeof parsed === 'object' &&
        parsed !== null &&
        'sections' in parsed &&
        'order' in parsed &&
        Array.isArray(parsed.order));
}
//# sourceMappingURL=utils.js.map