"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSettingsCategory = isSettingsCategory;
exports.isInputSetting = isInputSetting;
function isSettingsCategory(x) {
    return 'settings' in x;
}
function isInputSetting(x) {
    return 'id' in x && 'type' in x && 'label' in x;
}
//# sourceMappingURL=index.js.map