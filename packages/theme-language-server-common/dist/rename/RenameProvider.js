"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameProvider = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const theme_check_common_2 = require("@shopify/theme-check-common");
const HtmlTagNameRenameProvider_1 = require("./providers/HtmlTagNameRenameProvider");
const LiquidVariableRenameProvider_1 = require("./providers/LiquidVariableRenameProvider");
/**
 * RenameProvider is responsible for providing rename support for the theme language server.
 *
 * Rename is a pretty abstract concept, it can be renaming a tag name, a variable, a class name, etc.
 */
class RenameProvider {
    constructor(connection, clientCapabilities, documentManager, findThemeRootURI) {
        this.documentManager = documentManager;
        this.providers = [
            new HtmlTagNameRenameProvider_1.HtmlTagNameRenameProvider(documentManager),
            new LiquidVariableRenameProvider_1.LiquidVariableRenameProvider(connection, clientCapabilities, documentManager, findThemeRootURI),
        ];
    }
    /** Prepare is for telling if you can rename this thing or not, and what text to rename */
    async prepare(params) {
        var _a;
        const [currentNode, ancestors] = this.nodes(params);
        if (currentNode === null || ancestors === null) {
            return null;
        }
        const promises = this.providers.map((provider) => provider
            .prepare(currentNode, ancestors, params)
            .catch(() => null));
        const results = await Promise.all(promises);
        return (_a = results.find(Boolean)) !== null && _a !== void 0 ? _a : null;
    }
    /** Rename is for actually renaming something */
    async rename(params) {
        var _a;
        const [currentNode, ancestors] = this.nodes(params);
        if (currentNode === null || ancestors === null) {
            return null;
        }
        const promises = this.providers.map((provider) => provider
            .rename(currentNode, ancestors, params)
            .catch(() => null));
        const results = await Promise.all(promises);
        return (_a = results.find(Boolean)) !== null && _a !== void 0 ? _a : null;
    }
    /** a helper for getting the node under the cursor and its ancestry */
    nodes(params) {
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document || document.type !== theme_check_common_1.SourceCodeType.LiquidHtml) {
            return [null, null];
        }
        if (!(document.ast instanceof Error)) {
            return (0, theme_check_common_2.findCurrentNode)(document.ast, document.textDocument.offsetAt(params.position));
        }
        return [null, null];
    }
}
exports.RenameProvider = RenameProvider;
//# sourceMappingURL=RenameProvider.js.map