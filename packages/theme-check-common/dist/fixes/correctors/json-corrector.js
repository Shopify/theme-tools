"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONCorrector = void 0;
const lodash_1 = require("lodash");
// This function mutates json. So use it in a reducer and consider it a
// fire and forget.
function applyPatch(json, operation) {
    switch (operation.type) {
        case 'add': {
            return (0, lodash_1.set)(json, operation.path, operation.value);
        }
        case 'remove': {
            (0, lodash_1.unset)(json, operation.path);
            return json;
        }
    }
}
/**
 * The JSONCorrector collects patches and then creates a Fix object
 * that represents the application of all the collected patches on the
 * source document.
 *
 * Fixes are assumed to not be overlapping.
 */
class JSONCorrector {
    constructor(source) {
        this.source = source;
        this.patches = [];
    }
    /**
     * corrector.fix is the data representation of all the changes to source.
     */
    get fix() {
        if (this.patches.length === 0)
            return [];
        const json = this.patches.reduce(applyPatch, JSON.parse(this.source));
        return {
            startIndex: 0,
            endIndex: this.source.length,
            insert: JSON.stringify(json, null, 2),
        };
    }
    /**
     * Add value at dot delited JSON path
     *
     * @example
     * corrector.add('missing.key', 'TO DO')
     */
    add(path, value) {
        this.patches.push({
            type: 'add',
            path,
            value,
        });
    }
    /**
     * Replace a value at dot delited JSON path.
     *
     * @example
     * corrector.replace('missing.key', 'TO DO')
     */
    replace(path, value) {
        this.patches.push({
            type: 'remove',
            path,
        }, {
            type: 'add',
            path,
            value,
        });
    }
    /**
     * Remove key from JSON object
     *
     * @example
     * corrector.remove('unneeded.key')
     */
    remove(path) {
        this.patches.push({
            type: 'remove',
            path,
        });
    }
}
exports.JSONCorrector = JSONCorrector;
//# sourceMappingURL=json-corrector.js.map