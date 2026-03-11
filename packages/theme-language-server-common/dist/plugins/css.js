"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCssLanguageService = getCssLanguageService;
const vscode_css_languageservice_1 = require("vscode-css-languageservice");
const cssLanguageService = (0, vscode_css_languageservice_1.getCSSLanguageService)();
const languageServices = {
    css: cssLanguageService,
};
function getCssLanguageService(kind) {
    return languageServices[kind];
}
//# sourceMappingURL=css.js.map