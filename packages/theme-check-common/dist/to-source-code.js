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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLiquidHTMLAST = toLiquidHTMLAST;
exports.toJSONAST = toJSONAST;
exports.toSourceCode = toSourceCode;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const parse_1 = require("./jsonc/parse");
const path = __importStar(require("./path"));
const types_1 = require("./types");
const error_1 = require("./utils/error");
function toLiquidHTMLAST(source) {
    try {
        return (0, liquid_html_parser_1.toLiquidHtmlAST)(source);
    }
    catch (error) {
        return (0, error_1.asError)(error);
    }
}
function toJSONAST(source) {
    try {
        return (0, parse_1.toJSONNode)(source);
    }
    catch (error) {
        return (0, error_1.asError)(error);
    }
}
function toSourceCode(uri, source, version) {
    const isLiquid = uri.endsWith('.liquid');
    if (isLiquid) {
        return {
            uri: path.normalize(uri),
            source,
            type: types_1.SourceCodeType.LiquidHtml,
            ast: toLiquidHTMLAST(source),
            version,
        };
    }
    else {
        return {
            uri: path.normalize(uri),
            source,
            type: types_1.SourceCodeType.JSON,
            ast: toJSONAST(source),
            version,
        };
    }
}
//# sourceMappingURL=to-source-code.js.map