"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompletionItem = void 0;
exports.sortByName = sortByName;
var CompletionItemProperties_1 = require("./CompletionItemProperties");
Object.defineProperty(exports, "createCompletionItem", { enumerable: true, get: function () { return CompletionItemProperties_1.createCompletionItem; } });
function sortByName({ name: nameA }, { name: nameB }) {
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }
    // names must be equal
    return 0;
}
//# sourceMappingURL=index.js.map