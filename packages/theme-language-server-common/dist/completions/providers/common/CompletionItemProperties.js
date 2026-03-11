"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompletionItem = createCompletionItem;
const vscode_languageserver_1 = require("vscode-languageserver");
const docset_1 = require("../../../docset");
// ASCII tokens that make a string appear lower in the list.
//
// It's setup so that we can show array filters before "global" filters,
// and similarly array deprecated filters before "global" deprecated
// filters.
var SortTokens;
(function (SortTokens) {
    SortTokens["normal"] = "";
    SortTokens["deprioritized"] = "{";
    SortTokens["deprecated"] = "|";
    SortTokens["deprecatedAndDeprioritized"] = "}";
})(SortTokens || (SortTokens = {}));
function createCompletionItem(entry, extraProperties = {}, docsetEntryType, entryType) {
    // prettier-ignore
    const sortToken = entry.deprecated
        ? entry.deprioritized
            ? SortTokens.deprecatedAndDeprioritized
            : SortTokens.deprecated
        : entry.deprioritized
            ? SortTokens.deprioritized
            : SortTokens.normal;
    return {
        label: entry.name,
        sortText: `${sortToken}${entry.name}`,
        ...documentationProperties(entry, docsetEntryType, entryType),
        ...deprecatedProperties(entry),
        ...extraProperties,
    };
}
function documentationProperties(entry, docsetEntryType, entryType) {
    const value = (0, docset_1.render)(entry, entryType, docsetEntryType);
    return {
        documentation: {
            kind: 'markdown',
            value,
        },
    };
}
function deprecatedProperties(entry) {
    if (!entry.deprecated)
        return {};
    const tags = [vscode_languageserver_1.CompletionItemTag.Deprecated];
    return {
        tags,
    };
}
//# sourceMappingURL=CompletionItemProperties.js.map