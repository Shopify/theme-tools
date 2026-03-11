"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigTarget = exports.Severity = exports.LiquidHtmlNodeTypes = exports.SourceCodeType = exports.Modes = exports.isLiteralNode = exports.isValueNode = exports.isPropertyNode = exports.isArrayNode = exports.isObjectNode = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
Object.defineProperty(exports, "LiquidHtmlNodeTypes", { enumerable: true, get: function () { return liquid_html_parser_1.NodeTypes; } });
__exportStar(require("./jsonc/types"), exports);
__exportStar(require("./types/schema-prop-factory"), exports);
__exportStar(require("./types/theme-liquid-docs"), exports);
__exportStar(require("./types/theme-schemas"), exports);
const isObjectNode = (node) => (node === null || node === void 0 ? void 0 : node.type) === 'Object';
exports.isObjectNode = isObjectNode;
const isArrayNode = (node) => (node === null || node === void 0 ? void 0 : node.type) === 'Array';
exports.isArrayNode = isArrayNode;
const isPropertyNode = (node) => (node === null || node === void 0 ? void 0 : node.type) === 'Property';
exports.isPropertyNode = isPropertyNode;
const isValueNode = (node) => (node === null || node === void 0 ? void 0 : node.type) === 'Value';
exports.isValueNode = isValueNode;
const isLiteralNode = (node) => (node === null || node === void 0 ? void 0 : node.type) === 'Literal';
exports.isLiteralNode = isLiteralNode;
exports.Modes = ['theme', 'app'];
var SourceCodeType;
(function (SourceCodeType) {
    SourceCodeType["JSON"] = "JSON";
    SourceCodeType["LiquidHtml"] = "LiquidHtml";
})(SourceCodeType || (exports.SourceCodeType = SourceCodeType = {}));
/** The severity determines the icon and color of diagnostics */
var Severity;
(function (Severity) {
    Severity[Severity["ERROR"] = 0] = "ERROR";
    Severity[Severity["WARNING"] = 1] = "WARNING";
    Severity[Severity["INFO"] = 2] = "INFO";
})(Severity || (exports.Severity = Severity = {}));
/** The yaml configurations to target checks */
var ConfigTarget;
(function (ConfigTarget) {
    ConfigTarget["All"] = "all";
    ConfigTarget["Recommended"] = "recommended";
    ConfigTarget["ThemeAppExtension"] = "theme-app-extension";
})(ConfigTarget || (exports.ConfigTarget = ConfigTarget = {}));
//# sourceMappingURL=types.js.map